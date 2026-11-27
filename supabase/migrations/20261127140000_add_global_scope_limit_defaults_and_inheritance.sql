begin;

create table if not exists public.api_scope_default_limits (
  service_slug text primary key references public.api_services(slug) on delete cascade,
  requests_per_minute integer not null check (requests_per_minute > 0),
  daily_weighted_limit bigint check (daily_weighted_limit is null or daily_weighted_limit > 0),
  monthly_weighted_limit bigint check (monthly_weighted_limit is null or monthly_weighted_limit > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.api_scope_default_limits enable row level security;
drop policy if exists api_scope_default_limits_admin_read on public.api_scope_default_limits;
create policy api_scope_default_limits_admin_read on public.api_scope_default_limits
  for select to authenticated using (private.bmg_is_admin());
grant select on public.api_scope_default_limits to authenticated;
revoke insert, update, delete on public.api_scope_default_limits from anon, authenticated;

create or replace function public.bmg_admin_set_scope_default_limits(
  p_service_slug text, p_requests_per_minute integer,
  p_daily_weighted_limit bigint default null, p_monthly_weighted_limit bigint default null
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private
as $function$
declare v_actor uuid:=auth.uid(); v_row public.api_scope_default_limits%rowtype;
begin
  if v_actor is null or not private.bmg_is_admin() then
    raise exception 'لا تملك صلاحية تعديل الحدود العامة.' using errcode='42501';
  end if;
  if p_service_slug is null or p_requests_per_minute is null or p_requests_per_minute<=0
    or (p_daily_weighted_limit is not null and p_daily_weighted_limit<=0)
    or (p_monthly_weighted_limit is not null and p_monthly_weighted_limit<=0) then
    raise exception 'قيم الحدود غير صالحة.';
  end if;
  if not exists(select 1 from public.api_services where slug=p_service_slug and archived_at is null) then
    raise exception 'الخدمة غير موجودة أو مؤرشفة.';
  end if;
  insert into public.api_scope_default_limits(service_slug,requests_per_minute,daily_weighted_limit,monthly_weighted_limit,updated_by,updated_at)
  values(p_service_slug,p_requests_per_minute,p_daily_weighted_limit,p_monthly_weighted_limit,v_actor,now())
  on conflict(service_slug) do update set requests_per_minute=excluded.requests_per_minute,
    daily_weighted_limit=excluded.daily_weighted_limit,monthly_weighted_limit=excluded.monthly_weighted_limit,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into v_row;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'scope_default_limits.upsert','api_scope_default_limits',v_row.service_slug,
    jsonb_build_object('requests_per_minute',v_row.requests_per_minute,
      'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit));
  return jsonb_build_object('service_slug',v_row.service_slug,'requests_per_minute',v_row.requests_per_minute,
    'daily_weighted_limit',v_row.daily_weighted_limit,'monthly_weighted_limit',v_row.monthly_weighted_limit,'updated_at',v_row.updated_at);
end;
$function$;

create or replace function public.bmg_admin_clear_organization_service_limits(p_organization_id uuid,p_service_slug text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $function$
declare v_actor uuid:=auth.uid(); v_row public.organization_service_limits%rowtype;
begin
  if v_actor is null or not private.bmg_is_admin() then raise exception 'لا تملك صلاحية تعديل حدود المؤسسات.' using errcode='42501'; end if;
  delete from public.organization_service_limits where organization_id=p_organization_id and service_slug=p_service_slug returning * into v_row;
  if found then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'organization_service_limits.clear','organization_service_limits',v_row.organization_id::text,
      jsonb_build_object('service_slug',v_row.service_slug));
  end if;
  return jsonb_build_object('cleared',found,'organization_id',p_organization_id,'service_slug',p_service_slug);
end;
$function$;

create or replace function public.bmg_admin_clear_project_service_limits(p_project_id uuid,p_service_slug text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $function$
declare v_actor uuid:=auth.uid(); v_row public.project_service_limits%rowtype;
begin
  if v_actor is null or not private.bmg_is_admin() then raise exception 'لا تملك صلاحية تعديل حدود المشاريع.' using errcode='42501'; end if;
  delete from public.project_service_limits where project_id=p_project_id and service_slug=p_service_slug returning * into v_row;
  if found then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'project_service_limits.clear','project_service_limits',v_row.project_id::text,
      jsonb_build_object('service_slug',v_row.service_slug));
  end if;
  return jsonb_build_object('cleared',found,'project_id',p_project_id,'service_slug',p_service_slug);
end;
$function$;

revoke all on function public.bmg_admin_set_scope_default_limits(text,integer,bigint,bigint) from public,anon;
revoke all on function public.bmg_admin_clear_organization_service_limits(uuid,text) from public,anon;
revoke all on function public.bmg_admin_clear_project_service_limits(uuid,text) from public,anon;
grant execute on function public.bmg_admin_set_scope_default_limits(text,integer,bigint,bigint) to authenticated;
grant execute on function public.bmg_admin_clear_organization_service_limits(uuid,text) to authenticated;
grant execute on function public.bmg_admin_clear_project_service_limits(uuid,text) to authenticated;

create or replace function public.bmg_authorize_api_request(p_key text,p_service_slug text,p_method text,p_server_secret text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,private,extensions
as $function$
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
  v_scope_rpm integer;
  v_scope_daily bigint;
  v_scope_monthly bigint;
  v_recent_count bigint;
  v_daily_usage bigint;
  v_monthly_usage bigint;
  v_usage_weight bigint;
  v_maintenance_message text;
  v_usage_id bigint;
  v_now timestamptz:=clock_timestamp();
  v_org_id uuid;
  v_project_id uuid;
  v_scope text;
  v_org_override boolean:=false;
  v_project_override boolean:=false;
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
  if v_maintenance_message is not null then
    return jsonb_build_object('authorized',false,'reason','maintenance','message',v_maintenance_message);
  end if;

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

  -- Scope limits are overrides, not cumulative quotas. A project's override wins;
  -- otherwise the organization override is inherited; otherwise use global defaults.
  if v_project_id is not null then
    select exists(select 1 from public.project_service_limits where project_id=v_project_id and service_slug=p_service_slug)
      into v_project_override;
  end if;
  if v_org_id is not null then
    select exists(select 1 from public.organization_service_limits where organization_id=v_org_id and service_slug=p_service_slug)
      into v_org_override;
  end if;

  if v_project_override then
    v_scope:='project';
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_scope_rpm,v_scope_daily,v_scope_monthly
      from public.project_service_limits where project_id=v_project_id and service_slug=p_service_slug;
  elsif v_org_override then
    v_scope:='organization';
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_scope_rpm,v_scope_daily,v_scope_monthly
      from public.organization_service_limits where organization_id=v_org_id and service_slug=p_service_slug;
  else
    v_scope:=case when v_project_id is not null then 'project' when v_org_id is not null then 'organization' else null end;
    select requests_per_minute,daily_weighted_limit,monthly_weighted_limit
      into v_scope_rpm,v_scope_daily,v_scope_monthly
      from public.api_scope_default_limits where service_slug=p_service_slug;
    -- A missing global row means scope limits are not configured; account/plan limits still apply.
    if not found then v_scope:=null; end if;
  end if;

  -- Account/plan limits are still enforced independently and are not replaced by scope settings.
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

  select count(*) into v_recent_count from private.api_usage u
  where u.user_id=found_key.user_id and u.created_at>v_now-interval '1 minute';
  if v_recent_count>=v_requests_per_minute then return jsonb_build_object('authorized',false,'reason','rate_limited'); end if;

  -- Enforce exactly one effective scope quota, with counters isolated by organization or project.
  if v_scope='organization' then
    perform pg_advisory_xact_lock(hashtextextended('nox_api_org:'||v_org_id::text||':'||p_service_slug,0));
    select count(*) into v_recent_count from private.api_usage u
      where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>v_now-interval '1 minute';
    if v_recent_count>=v_scope_rpm then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization'); end if;
    if v_scope_daily is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.organization_id=v_org_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('day',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
      ) x;
      if v_daily_usage+v_usage_weight>v_scope_daily then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization'); end if;
    end if;
    if v_scope_monthly is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.organization_id=v_org_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('month',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.organization_id=v_org_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
      ) x;
      if v_monthly_usage+v_usage_weight>v_scope_monthly then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','organization'); end if;
    end if;
  elsif v_scope='project' then
    perform pg_advisory_xact_lock(hashtextextended('nox_api_project:'||v_project_id::text||':'||p_service_slug,0));
    select count(*) into v_recent_count from private.api_usage u
      where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>v_now-interval '1 minute';
    if v_recent_count>=v_requests_per_minute then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project'); end if;
    if v_daily_limit is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_daily_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.project_id=v_project_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('day',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('day',v_now) and u.aggregated_at is null
      ) x;
      if v_daily_usage+v_usage_weight>v_daily_limit then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project'); end if;
    end if;
    if v_monthly_limit is not null then
      select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (
        select h.weighted_usage from private.api_usage_hourly h
        where h.project_id=v_project_id and h.service_slug=p_service_slug and h.bucket_hour>=date_trunc('month',v_now)
        union all select greatest(1,coalesce(u.service_weight,1))::bigint from private.api_usage u
        where u.project_id=v_project_id and u.service_slug=p_service_slug and u.created_at>=date_trunc('month',v_now) and u.aggregated_at is null
      ) x;
      if v_monthly_usage+v_usage_weight>v_monthly_limit then return jsonb_build_object('authorized',false,'reason','rate_limited','limit_scope','project'); end if;
    end if;
  end if;

  -- Re-check account/plan daily and monthly consumption separately.
  if v_role in ('admin','owner') then
    select daily_weighted_limit,monthly_weighted_limit into v_daily_limit,v_monthly_limit
      from public.api_admin_limits where id=true;
  else
    select daily_weighted_limit,monthly_weighted_limit into v_daily_limit,v_monthly_limit
      from public.api_plan_limits where plan=case when v_plan in ('basic','pro','premium') then v_plan else 'basic' end;
  end if;
  v_daily_limit:=greatest(1,coalesce(v_daily_limit,1000));
  v_monthly_limit:=greatest(1,coalesce(v_monthly_limit,20000));
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
  return jsonb_build_object('authorized',true,'usage_id',v_usage_id,'limit_scope',v_scope);
end;
$function$;

revoke all on function public.bmg_authorize_api_request(text,text,text,text) from public;
grant execute on function public.bmg_authorize_api_request(text,text,text,text) to anon,authenticated;

commit;
