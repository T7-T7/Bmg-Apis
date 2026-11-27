begin;
create or replace function public.bmg_get_organization_usage(
  p_organization_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_owner uuid;
  v_is_default boolean;
  v_days integer:=greatest(1,least(coalesce(p_days,30),90));
  v_allocation record;
  v_daily_usage bigint:=0;
  v_monthly_usage bigint:=0;
  v_daily_requests bigint:=0;
  v_monthly_requests bigint:=0;
  v_rpm_usage bigint:=0;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select o.owner_id,o.is_default_workspace into v_owner,v_is_default
  from public.organizations o where o.id=p_organization_id;
  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor)
     and v_owner<>v_actor then
    raise exception 'Workspace access required' using errcode='42501';
  end if;
  if v_is_default then raise exception 'Default personal usage is available in account usage'; end if;

  select * into v_allocation from private.bmg_get_scope_pool_allocation(p_organization_id);

  -- Raw usage is retained for 24 hours. Use it for the live window, including
  -- rows already aggregated; use hourly rollups only for older periods.
  select coalesce(sum(greatest(1,coalesce(u.service_weight,1))),0)::bigint
  into v_daily_usage
  from private.api_usage u
  left join public.projects p on p.id=u.project_id
  where coalesce(u.organization_id,p.organization_id)=p_organization_id
    and u.created_at>=date_trunc('day',now());

  select count(*)::bigint into v_daily_requests
  from private.api_usage u
  left join public.projects p on p.id=u.project_id
  where coalesce(u.organization_id,p.organization_id)=p_organization_id
    and u.created_at>=date_trunc('day',now());

  select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage
  from (
    select h.weighted_usage
    from private.api_usage_hourly h
    where h.organization_id=p_organization_id
      and h.bucket_hour>=date_trunc('month',now())
      and h.bucket_hour<date_trunc('hour',now()-interval '24 hours')
    union all
    select greatest(1,coalesce(u.service_weight,1))::bigint
    from private.api_usage u
    left join public.projects p on p.id=u.project_id
    where coalesce(u.organization_id,p.organization_id)=p_organization_id
      and u.created_at>=greatest(date_trunc('month',now()),now()-interval '24 hours')
  ) x;

  select coalesce(sum(x.request_count),0)::bigint into v_monthly_requests
  from (
    select h.request_count
    from private.api_usage_hourly h
    where h.organization_id=p_organization_id
      and h.bucket_hour>=date_trunc('month',now())
      and h.bucket_hour<date_trunc('hour',now()-interval '24 hours')
    union all
    select 1::bigint
    from private.api_usage u
    left join public.projects p on p.id=u.project_id
    where coalesce(u.organization_id,p.organization_id)=p_organization_id
      and u.created_at>=greatest(date_trunc('month',now()),now()-interval '24 hours')
  ) x;

  select count(*)::bigint into v_rpm_usage
  from private.api_usage u
  left join public.projects p on p.id=u.project_id
  where coalesce(u.organization_id,p.organization_id)=p_organization_id
    and u.created_at>now()-interval '1 minute';

  with events as (
    select h.project_id,h.service_slug,h.request_count,h.weighted_usage,h.bucket_hour as created_at
    from private.api_usage_hourly h
    where h.organization_id=p_organization_id
      and h.bucket_hour>=now()-make_interval(days=>v_days)
      and h.bucket_hour<now()-interval '24 hours'
    union all
    select u.project_id,u.service_slug,1::bigint,
      greatest(1,coalesce(u.service_weight,1))::bigint,u.created_at
    from private.api_usage u
    left join public.projects scope_project on scope_project.id=u.project_id
    where coalesce(u.organization_id,scope_project.organization_id)=p_organization_id
      and u.created_at>=greatest(now()-make_interval(days=>v_days),now()-interval '24 hours')
  ),
  project_totals as (
    select e.project_id,coalesce(p.name,'مشروع محذوف') as name,
      sum(e.request_count)::bigint as requests,sum(e.weighted_usage)::bigint as weighted_usage
    from events e left join public.projects p on p.id=e.project_id
    group by e.project_id,p.name
  ),
  service_totals as (
    select service_slug,sum(request_count)::bigint as requests,sum(weighted_usage)::bigint as weighted_usage
    from events group by service_slug
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',u.id,'projectId',u.project_id,'service',u.service_slug,'method',u.request_method,
      'status',u.status_code,'latency',u.latency_ms,'createdAt',u.created_at
    ) order by u.created_at desc),'[]'::jsonb) as value
    from (
      select usage_row.*
      from private.api_usage usage_row
      left join public.projects scope_project on scope_project.id=usage_row.project_id
      where coalesce(usage_row.organization_id,scope_project.organization_id)=p_organization_id
      order by usage_row.created_at desc limit 20
    ) u
  )
  select jsonb_build_object(
    'periodDays',v_days,
    'organization',jsonb_build_object('id',p_organization_id,'ownerId',v_owner),
    'allocation',jsonb_build_object(
      'scopeCount',v_allocation.scope_count,'scopePosition',v_allocation.scope_position,
      'requestsPerMinute',v_allocation.requests_per_minute,
      'dailyWeightedLimit',v_allocation.daily_weighted_limit,
      'monthlyWeightedLimit',v_allocation.monthly_weighted_limit
    ),
    'usage',jsonb_build_object(
      'requestsPerMinute',v_rpm_usage,
      'dailyRequests',v_daily_requests,
      'monthlyRequests',v_monthly_requests,
      'dailyWeightedUsage',v_daily_usage,
      'monthlyWeightedUsage',v_monthly_usage,
      'dailyRemaining',case when v_allocation.daily_weighted_limit is null then null else greatest(0,v_allocation.daily_weighted_limit-v_daily_usage) end,
      'monthlyRemaining',case when v_allocation.monthly_weighted_limit is null then null else greatest(0,v_allocation.monthly_weighted_limit-v_monthly_usage) end,
      'dailyPercentage',case when v_allocation.daily_weighted_limit is null then null else round(v_daily_usage::numeric/nullif(v_allocation.daily_weighted_limit,0)*100,1) end,
      'monthlyPercentage',case when v_allocation.monthly_weighted_limit is null then null else round(v_monthly_usage::numeric/nullif(v_allocation.monthly_weighted_limit,0)*100,1) end
    ),
    'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',project_id,'name',name,'requests',requests,'weightedUsage',weighted_usage) order by weighted_usage desc),'[]'::jsonb) from project_totals),
    'services',(select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'requests',requests,'weightedUsage',weighted_usage) order by weighted_usage desc),'[]'::jsonb) from service_totals),
    'recent',recent.value
  ) into v_result
  from recent;

  return v_result;
end;
$function$;
commit;