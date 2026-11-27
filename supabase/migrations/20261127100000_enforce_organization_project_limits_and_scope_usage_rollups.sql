begin;

alter table private.api_usage_hourly
  add column if not exists organization_id uuid,
  add column if not exists project_id uuid;

create unique index if not exists api_usage_hourly_scope_uidx
on private.api_usage_hourly (
  bucket_hour,user_id,service_slug,status_code,
  (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)),
  (coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid))
);
create index if not exists api_usage_hourly_org_scope_idx
  on private.api_usage_hourly(organization_id,service_slug,bucket_hour);
create index if not exists api_usage_hourly_project_scope_idx
  on private.api_usage_hourly(project_id,service_slug,bucket_hour);

CREATE OR REPLACE FUNCTION private.bmg_aggregate_api_usage()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_count integer := 0;
begin
  with pending as materialized (
    select u.id,u.user_id,u.organization_id,u.project_id,u.service_slug,
      coalesce(u.status_code,0)::smallint status_code,u.latency_ms,u.service_weight,
      date_trunc('hour',u.created_at) bucket_hour
    from private.api_usage u
    where u.aggregated_at is null and u.created_at < now()-interval '10 minutes'
    order by u.created_at limit 20000 for update skip locked
  ), grouped as (
    select bucket_hour,user_id,organization_id,project_id,service_slug,status_code,
      count(*)::bigint request_count,
      count(*) filter(where status_code between 200 and 399)::bigint success_count,
      count(*) filter(where status_code>=400)::bigint error_count,
      count(latency_ms)::bigint latency_count,
      coalesce(sum(latency_ms),0)::bigint total_latency_ms,
      coalesce(sum(service_weight),0)::bigint weighted_usage
    from pending
    group by bucket_hour,user_id,organization_id,project_id,service_slug,status_code
  ), upserted as (
    insert into private.api_usage_hourly(
      bucket_hour,user_id,organization_id,project_id,service_slug,status_code,
      request_count,success_count,error_count,latency_count,total_latency_ms,weighted_usage,updated_at
    )
    select bucket_hour,user_id,organization_id,project_id,service_slug,status_code,
      request_count,success_count,error_count,latency_count,total_latency_ms,weighted_usage,now()
    from grouped
    on conflict (
      bucket_hour,user_id,service_slug,status_code,
      (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)),
      (coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid))
    ) do update set
      request_count=private.api_usage_hourly.request_count+excluded.request_count,
      success_count=private.api_usage_hourly.success_count+excluded.success_count,
      error_count=private.api_usage_hourly.error_count+excluded.error_count,
      latency_count=private.api_usage_hourly.latency_count+excluded.latency_count,
      total_latency_ms=private.api_usage_hourly.total_latency_ms+excluded.total_latency_ms,
      weighted_usage=private.api_usage_hourly.weighted_usage+excluded.weighted_usage,
      updated_at=now()
    returning 1
  )
  update private.api_usage u set aggregated_at=now()
  from pending p where u.id=p.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$


CREATE OR REPLACE FUNCTION public.bmg_authorize_api_request(p_key text, p_service_slug text, p_method text, p_server_secret text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'extensions'
AS $function$
declare
  found_key private.api_keys%rowtype;
  v_secret_hash bytea;
  v_service_status text;
  v_service_id uuid;
  v_service_archived boolean;
  v_service_weight integer;
  v_service_category text;
  v_account_status text;
  v_role text;
  v_plan text;
  v_requests_per_minute integer;
  v_daily_limit bigint;
  v_monthly_limit bigint;
  v_recent_count bigint;
  v_daily_usage bigint;
  v_monthly_usage bigint;
  v_usage_weight bigint;
  v_maintenance_message text;
  v_usage_id bigint;
  v_now timestamptz := clock_timestamp();
  v_org_id uuid;
  v_project_id uuid;
  v_org_rpm integer;
  v_org_daily bigint;
  v_org_monthly bigint;
  v_project_rpm integer;
  v_project_daily bigint;
  v_project_monthly bigint;
begin
  if p_server_secret is null then return jsonb_build_object('authorized',false,'reason','invalid_server'); end if;
  select secret_hash into v_secret_hash from private.api_demo_config where id=true;
  if v_secret_hash is null or v_secret_hash<>extensions.digest(convert_to(p_server_secret,'UTF8'),'sha256') then
    return jsonb_build_object('authorized',false,'reason','invalid_server');
  end if;
  if p_key is null or length(p_key)<40 then return jsonb_build_object('authorized',false,'reason','invalid_key'); end if;

  select * into found_key from private.api_keys
  where key_hash=extensions.digest(p_key,'sha256') and revoked_at is null
    and (expires_at is null or expires_at>v_now) and scopes @> array['api:use']::text[]
  limit 1 for update;
  if found_key.id is null then return jsonb_build_object('authorized',false,'reason','invalid_key'); end if;

  perform pg_advisory_xact_lock(hashtextextended('nox_api_account:'||found_key.user_id::text,0));

  select p.account_status,p.role,p.plan into v_account_status,v_role,v_plan
  from public.profiles p where p.id=found_key.user_id;
  if v_account_status is distinct from 'active' then return jsonb_build_object('authorized',false,'reason','account_suspended'); end if;

  select s.id,s.status,(s.archived_at is not null),s.weight,s.category
  into v_service_id,v_service_status,v_service_archived,v_service_weight,v_service_category
  from public.api_services s where s.slug=p_service_slug;
  if v_service_status is distinct from 'active' or coalesce(v_service_archived,true) then
    return jsonb_build_object('authorized',false,'reason','service_unavailable');
  end if;

  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'service:%')
     and not found_key.scopes @> array['service:'||p_service_slug]::text[] then
    return jsonb_build_object('authorized',false,'reason','insufficient_scope');
  end if;
  if exists(select 1 from unnest(found_key.scopes) sc where sc like 'category:%')
     and not found_key.scopes @> array['category:'||lower(coalesce(v_service_category,''))]::text[] then
    return jsonb_build_object('authorized',false,'reason','insufficient_scope');
  end if;

  select m.message into v_maintenance_message from public.maintenance_windows m
  where m.enabled=true and (m.service_id is null or m.service_id=v_service_id)
    and (m.starts_at is null or m.starts_at<=v_now) and (m.ends_at is null or m.ends_at>v_now)
  order by (m.service_id is not null) desc,m.updated_at desc limit 1;
  if v_maintenance_message is not null then return jsonb_build_object('authorized',false,'reason','maintenance','message',v_maintenance_message); end if;

  if v_role in ('admin','owner') then
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_requests_per_minute,v_daily_limit,v_monthly_limit from public.api_admin_limits where id=true;
  else
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_requests_per_minute,v_daily_limit,v_monthly_limit from public.api_plan_limits
      where plan=case when v_plan in ('basic','pro','premium') then v_plan else 'basic' end;
  end if;
  v_requests_per_minute:=greatest(1,coalesce(v_requests_per_minute,30));
  v_daily_limit:=greatest(1,coalesce(v_daily_limit,1000));
  v_monthly_limit:=greatest(1,coalesce(v_monthly_limit,20000));
  v_usage_weight:=greatest(1,coalesce(v_service_weight,1));

  v_project_id:=found_key.project_id;
  v_org_id:=found_key.organization_id;
  if v_project_id is not null then
    select pr.organization_id into v_org_id from public.projects pr where pr.id=v_project_id;
    if not found then return jsonb_build_object('authorized',false,'reason','invalid_project'); end if;
  end if;

  select count(*) into v_recent_count from private.api_usage u
  where u.user_id=found_key.user_id and u.created_at>v_now-interval '1 minute';
  if v_recent_count>=v_requests_per_minute then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
  into v_org_rpm,v_org_daily,v_org_monthly
  from public.organization_service_limits
  where organization_id=v_org_id and service_slug=p_service_slug;
  if v_org_id is not null and found then
    perform pg_advisory_xact_lock(hashtextextended('nox_api_org:'||v_org_id::text||':'||p_service_slug,0));
    select count(*) into v_recent_count from private.api_usage u
    where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>v_now-interval '1 minute';
    if v_recent_count>=v_org_rpm then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization'); end if;
    if v_org_daily is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.organization_id=v_org_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('day',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
      ) x;
      if v_daily_usage+v_usage_weight>v_org_daily then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization'); end if;
    end if;
    if v_org_monthly is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.organization_id=v_org_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('month',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
      ) x;
      if v_monthly_usage+v_usage_weight>v_org_monthly then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization'); end if;
    end if;
  end if;

  select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
  into v_project_rpm,v_project_daily,v_project_monthly
  from public.project_service_limits where project_id=v_project_id and service_slug=p_service_slug;
  if v_project_id is not null and found then
    perform pg_advisory_xact_lock(hashtextextended('nox_api_project:'||v_project_id::text||':'||p_service_slug,0));
    select count(*) into v_recent_count from private.api_usage u
    where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>v_now-interval '1 minute';
    if v_recent_count>=v_project_rpm then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project'); end if;
    if v_project_daily is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.project_id=v_project_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('day',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
      ) x;
      if v_daily_usage+v_usage_weight>v_project_daily then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project'); end if;
    end if;
    if v_project_monthly is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.project_id=v_project_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('month',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
      ) x;
      if v_monthly_usage+v_usage_weight>v_project_monthly then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project'); end if;
    end if;
  end if;

  select coalesce(sum(q.weighted_usage),0)::bigint into v_daily_usage from (
    select h.weighted_usage from private.api_usage_hourly h where h.user_id=found_key.user_id and h.bucket_hour>=date_trunc('day',v_now)
    union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
    where u.user_id=found_key.user_id and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
  ) q;
  if v_daily_usage+v_usage_weight>v_daily_limit then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  select coalesce(sum(q.weighted_usage),0)::bigint into v_monthly_usage from (
    select h.weighted_usage from private.api_usage_hourly h where h.user_id=found_key.user_id and h.bucket_hour>=date_trunc('month',v_now)
    union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
    where u.user_id=found_key.user_id and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
  ) q;
  if v_monthly_usage+v_usage_weight>v_monthly_limit then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  update private.api_keys set last_used_at=v_now where id=found_key.id;
  insert into private.api_usage(api_key_id,user_id,organization_id,project_id,service_slug,request_method,service_weight)
  values(found_key.id,found_key.user_id,v_org_id,v_project_id,p_service_slug,upper(coalesce(p_method,'POST')),v_usage_weight)
  returning id into v_usage_id;

  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_24h',0)) then
    delete from private.api_usage where created_at<v_now-interval '24 hours' and aggregated_at is not null;
  end if;
  return jsonb_build_object('authorized',true,'usage_id',v_usage_id);
end;
$function$


revoke all on function public.bmg_authorize_api_request(text,text,text,text) from public;
grant execute on function public.bmg_authorize_api_request(text,text,text,text) to anon,authenticated;

commit;
