begin;
lock table private.api_usage in access exclusive mode;
lock table private.api_usage_hourly in access exclusive mode;

create table private.api_usage_monthly_counters (
  period_start date not null,
  user_id uuid not null,
  organization_id uuid,
  project_id uuid,
  service_slug text not null,
  request_count bigint not null default 0 check (request_count >= 0),
  weighted_usage bigint not null default 0 check (weighted_usage >= 0),
  updated_at timestamptz not null default now()
);

create unique index api_usage_monthly_counters_scope_uidx
on private.api_usage_monthly_counters (
  period_start,user_id,service_slug,
  (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)),
  (coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid))
);
create index api_usage_monthly_counters_org_idx on private.api_usage_monthly_counters (organization_id,period_start,service_slug);
create index api_usage_monthly_counters_project_idx on private.api_usage_monthly_counters (project_id,period_start,service_slug);
create index api_usage_monthly_counters_user_idx on private.api_usage_monthly_counters (user_id,period_start,service_slug);
alter table private.api_usage_monthly_counters enable row level security;
revoke all on table private.api_usage_monthly_counters from public,anon,authenticated;

create or replace function private.bmg_get_monthly_usage(
  p_period_start date,p_user_id uuid,p_organization_id uuid,p_project_id uuid,p_service_slug text
)
returns table(request_count bigint,weighted_usage bigint)
language sql stable security definer set search_path=''
as $function$
  with counter_usage as (
    select coalesce(sum(c.request_count),0)::bigint request_count,
           coalesce(sum(c.weighted_usage),0)::bigint weighted_usage
    from private.api_usage_monthly_counters c
    where c.period_start=p_period_start
      and (p_user_id is null or c.user_id=p_user_id)
      and (p_organization_id is null or c.organization_id=p_organization_id)
      and (p_project_id is null or c.project_id=p_project_id)
      and (p_service_slug is null or c.service_slug=p_service_slug)
  ), pending_usage as (
    select count(*)::bigint request_count,
           coalesce(sum(greatest(1,coalesce(u.service_weight,1))),0)::bigint weighted_usage
    from private.api_usage u
    where u.aggregated_at is null
      and u.created_at>=p_period_start::timestamptz
      and u.created_at<(p_period_start+interval '1 month')::timestamptz
      and (p_user_id is null or u.user_id=p_user_id)
      and (p_organization_id is null or u.organization_id=p_organization_id)
      and (p_project_id is null or u.project_id=p_project_id)
      and (p_service_slug is null or u.service_slug=p_service_slug)
  )
  select c.request_count+p.request_count,c.weighted_usage+p.weighted_usage
  from counter_usage c cross join pending_usage p;
$function$;
revoke all on function private.bmg_get_monthly_usage(date,uuid,uuid,uuid,text) from public,anon,authenticated;

insert into private.api_usage_monthly_counters(
  period_start,user_id,organization_id,project_id,service_slug,request_count,weighted_usage,updated_at
)
select period_start,user_id,organization_id,project_id,service_slug,
       sum(request_count)::bigint,sum(weighted_usage)::bigint,now()
from (
  select date_trunc('month',h.bucket_hour)::date period_start,h.user_id,h.organization_id,h.project_id,h.service_slug,
         h.request_count,h.weighted_usage
  from private.api_usage_hourly h
  union all
  select date_trunc('month',u.created_at)::date,u.user_id,u.organization_id,u.project_id,u.service_slug,
         1::bigint,greatest(1,coalesce(u.service_weight,1))::bigint
  from private.api_usage u where u.aggregated_at is null
) source_rows
group by period_start,user_id,organization_id,project_id,service_slug;

create or replace function private.bmg_aggregate_api_usage()
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer:=0;
begin
  with pending as materialized (
    select u.id,u.user_id,u.organization_id,u.project_id,u.service_slug,
      coalesce(u.status_code,0)::smallint status_code,u.latency_ms,u.service_weight,
      date_trunc('hour',u.created_at) bucket_hour,date_trunc('month',u.created_at)::date period_start
    from private.api_usage u
    where u.aggregated_at is null and u.created_at<now()-interval '10 minutes'
    order by u.created_at limit 20000 for update skip locked
  ), grouped as (
    select bucket_hour,user_id,organization_id,project_id,service_slug,status_code,
      count(*)::bigint request_count,
      count(*) filter(where status_code between 200 and 399)::bigint success_count,
      count(*) filter(where status_code>=400)::bigint error_count,
      count(latency_ms)::bigint latency_count,
      coalesce(sum(latency_ms),0)::bigint total_latency_ms,
      coalesce(sum(service_weight),0)::bigint weighted_usage
    from pending group by bucket_hour,user_id,organization_id,project_id,service_slug,status_code
  ), hourly_upserted as (
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
  ), monthly_grouped as (
    select period_start,user_id,organization_id,project_id,service_slug,
      count(*)::bigint request_count,coalesce(sum(service_weight),0)::bigint weighted_usage
    from pending group by period_start,user_id,organization_id,project_id,service_slug
  ), monthly_upserted as (
    insert into private.api_usage_monthly_counters(
      period_start,user_id,organization_id,project_id,service_slug,request_count,weighted_usage,updated_at
    )
    select period_start,user_id,organization_id,project_id,service_slug,request_count,weighted_usage,now()
    from monthly_grouped
    on conflict (
      period_start,user_id,service_slug,
      (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)),
      (coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid))
    ) do update set
      request_count=private.api_usage_monthly_counters.request_count+excluded.request_count,
      weighted_usage=private.api_usage_monthly_counters.weighted_usage+excluded.weighted_usage,
      updated_at=now()
    returning 1
  )
  update private.api_usage u set aggregated_at=now()
  from pending p where u.id=p.id;
  get diagnostics v_count=row_count;
  return v_count;
end;
$function$;

do $migration$
declare
  v_def text;
  v_pattern text;
  v_replacement text;
begin
  v_def:=pg_get_functiondef('public.bmg_authorize_api_request(text,text,text,text)'::regprocedure);
  v_pattern:=$re$select coalesce\(sum\(x\.weighted_usage\),0\)::bigint into v_monthly_usage from \(\s*select h\.weighted_usage from private\.api_usage_hourly h\s*where h\.organization_id=v_org_id and h\.bucket_hour>=date_trunc\('month',v_now\)\s*union all select greatest\(1,coalesce\(u\.service_weight,1\)\)::bigint from private\.api_usage u\s*where u\.organization_id=v_org_id and u\.created_at>=date_trunc\('month',v_now\) and u\.aggregated_at is null\s*\) x;$re$;
  if regexp_count(v_def,v_pattern)<>2 then raise exception 'Account/workspace quota blocks mismatch'; end if;
  v_replacement:=$rep$select usage.weighted_usage into v_monthly_usage
    from private.bmg_get_monthly_usage(date_trunc('month',v_now)::date,
      case when v_is_default then found_key.user_id else null end,v_org_id,null,null) usage;$rep$;
  v_def:=regexp_replace(v_def,v_pattern,v_replacement,'g');

  v_pattern:=$re$select coalesce\(sum\(x\.weighted_usage\),0\)::bigint into v_monthly_usage from \(\s*select h\.weighted_usage from private\.api_usage_hourly h\s*where h\.project_id=v_project_id and h\.service_slug=p_service_slug and h\.bucket_hour>=date_trunc\('month',v_now\)\s*union all select greatest\(1,coalesce\(u\.service_weight,1\)\)::bigint from private\.api_usage u\s*where u\.project_id=v_project_id and u\.service_slug=p_service_slug and u\.created_at>=date_trunc\('month',v_now\) and u\.aggregated_at is null\s*\) x;$re$;
  if regexp_count(v_def,v_pattern)<>1 then raise exception 'Project quota block mismatch'; end if;
  v_replacement:=$rep$select usage.weighted_usage into v_monthly_usage
        from private.bmg_get_monthly_usage(date_trunc('month',v_now)::date,null,null,v_project_id,p_service_slug) usage;$rep$;
  v_def:=regexp_replace(v_def,v_pattern,v_replacement);

  v_pattern:=$re$select coalesce\(sum\(x\.weighted_usage\),0\)::bigint into v_monthly_usage from \(\s*select h\.weighted_usage from private\.api_usage_hourly h\s*where h\.organization_id=v_org_id and h\.service_slug=p_service_slug and h\.bucket_hour>=date_trunc\('month',v_now\)\s*union all select greatest\(1,coalesce\(u\.service_weight,1\)\)::bigint from private\.api_usage u\s*where u\.organization_id=v_org_id and u\.service_slug=p_service_slug and u\.created_at>=date_trunc\('month',v_now\) and u\.aggregated_at is null\s*\) x;$re$;
  if regexp_count(v_def,v_pattern)<>1 then raise exception 'Organization service quota block mismatch'; end if;
  v_replacement:=$rep$select usage.weighted_usage into v_monthly_usage
        from private.bmg_get_monthly_usage(date_trunc('month',v_now)::date,null,v_org_id,null,p_service_slug) usage;$rep$;
  v_def:=regexp_replace(v_def,v_pattern,v_replacement);
  execute v_def;

  v_def:=pg_get_functiondef('public.bmg_get_api_analytics(integer)'::regprocedure);
  v_pattern:=$re$select coalesce\(sum\(weighted_usage\),0\)::bigint into v_monthly_usage\s+from \(\s*select weighted_usage from private\.api_usage_hourly\s+where organization_id=v_default_org_id and bucket_hour>=date_trunc\('month',now\(\)\)\s+union all\s+select greatest\(1,coalesce\(service_weight,1\)\)::bigint from private\.api_usage\s+where organization_id=v_default_org_id and created_at>=date_trunc\('month',now\(\)\) and aggregated_at is null\s*\) usage_rows;$re$;
  if regexp_count(v_def,v_pattern)<>1 then raise exception 'Personal analytics monthly block mismatch'; end if;
  v_replacement:=$rep$select usage.weighted_usage into v_monthly_usage
  from private.bmg_get_monthly_usage(date_trunc('month',now())::date,v_user_id,v_default_org_id,null,null) usage;$rep$;
  v_def:=regexp_replace(v_def,v_pattern,v_replacement);
  v_def:=replace(v_def,'least(coalesce(p_days,1),90)','least(coalesce(p_days,1),4)');
  execute v_def;

  v_def:=pg_get_functiondef('public.bmg_get_admin_analytics(integer,text,uuid,text,integer)'::regprocedure);
  if position('least(coalesce(p_days,7),90)' in v_def)=0 then raise exception 'Admin analytics clamp not found'; end if;
  v_def:=replace(v_def,'least(coalesce(p_days,7),90)','least(coalesce(p_days,7),4)');
  execute v_def;

  v_def:=pg_get_functiondef('public.bmg_get_organization_usage(uuid,integer)'::regprocedure);
  v_pattern:=$re$select coalesce\(sum\(x\.weighted_usage\),0\)::bigint into v_monthly_usage\s+from \(\s*select h\.weighted_usage\s+from private\.api_usage_hourly h\s+where h\.organization_id=p_organization_id\s+and h\.bucket_hour>=date_trunc\('month',now\(\)\)\s+and h\.bucket_hour<date_trunc\('hour',now\(\)-interval '24 hours'\)\s+union all\s+select greatest\(1,coalesce\(u\.service_weight,1\)\)::bigint\s+from private\.api_usage u\s+left join public\.projects p on p\.id=u\.project_id\s+where coalesce\(u\.organization_id,p\.organization_id\)=p_organization_id\s+and u\.created_at>=greatest\(date_trunc\('month',now\(\)\),now\(\)-interval '24 hours'\)\s*\) x;$re$;
  if regexp_count(v_def,v_pattern)<>1 then raise exception 'Workspace monthly weighted block mismatch'; end if;
  v_replacement:=$rep$select usage.weighted_usage,usage.request_count
into v_monthly_usage,v_monthly_requests
from private.bmg_get_monthly_usage(date_trunc('month',now())::date,null,p_organization_id,null,null) usage;$rep$;
  v_def:=regexp_replace(v_def,v_pattern,v_replacement);

  v_pattern:=$re$select coalesce\(sum\(x\.request_count\),0\)::bigint into v_monthly_requests\s+from \(\s*select h\.request_count\s+from private\.api_usage_hourly h\s+where h\.organization_id=p_organization_id\s+and h\.bucket_hour>=date_trunc\('month',now\(\)\)\s+and h\.bucket_hour<date_trunc\('hour',now\(\)-interval '24 hours'\)\s+union all\s+select 1::bigint\s+from private\.api_usage u\s+left join public\.projects p on p\.id=u\.project_id\s+where coalesce\(u\.organization_id,p\.organization_id\)=p_organization_id\s+and u\.created_at>=greatest\(date_trunc\('month',now\(\)\),now\(\)-interval '24 hours'\)\s*\) x;$re$;
  if regexp_count(v_def,v_pattern)<>1 then raise exception 'Workspace monthly request block mismatch'; end if;
  v_def:=regexp_replace(v_def,v_pattern,'');
  v_def:=replace(v_def,'least(coalesce(p_days,30),90)','least(coalesce(p_days,30),4)');
  execute v_def;
end;
$migration$;
commit;
