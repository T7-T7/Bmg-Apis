begin;

create or replace function public.bmg_get_admin_analytics(
  p_days integer default 7,
  p_service text default null,
  p_user_id uuid default null,
  p_category text default null,
  p_status_code integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_days integer := greatest(1,least(coalesce(p_days,7),90));
  v_result jsonb;
begin
  if not private.bmg_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  with events as (
    select h.user_id,h.service_slug,h.status_code,h.request_count,h.success_count,h.error_count,
           h.latency_count,h.total_latency_ms,h.weighted_usage,h.bucket_hour as created_at
    from private.api_usage_hourly h
    where h.bucket_hour >= now() - make_interval(days=>v_days)
    union all
    select u.user_id,u.service_slug,coalesce(u.status_code,0)::smallint,1::bigint,
           case when u.status_code between 200 and 399 then 1 else 0 end::bigint,
           case when u.status_code>=400 then 1 else 0 end::bigint,
           case when u.latency_ms is not null then 1 else 0 end::bigint,
           coalesce(u.latency_ms,0)::bigint,
           greatest(1,coalesce(u.service_weight,1))::bigint,
           u.created_at
    from private.api_usage u
    where u.created_at >= now() - make_interval(days=>v_days)
      and u.aggregated_at is null
  ),
  filtered as (
    select e.*,s.category
    from events e
    left join public.api_services s on s.slug=e.service_slug
    where (p_service is null or e.service_slug=p_service)
      and (p_user_id is null or e.user_id=p_user_id)
      and (p_category is null or s.category=p_category)
      and (p_status_code is null or e.status_code=p_status_code)
  ),
  totals as (
    select coalesce(sum(request_count),0)::bigint as requests,
      coalesce(sum(weighted_usage),0)::bigint as weighted_usage,
      coalesce(sum(success_count),0)::bigint as successful,
      coalesce(sum(error_count),0)::bigint as errors,
      coalesce(sum(latency_count),0)::bigint as latency_count,
      coalesce(sum(total_latency_ms),0)::bigint as total_latency,
      coalesce(sum(request_count) filter(where status_code>0),0)::bigint as measured
    from filtered
  ),
  days as (
    select (current_date-(v_days-1)+n)::date as day from generate_series(0,v_days-1) as n
  ),
  daily_rows as (
    select d.day,coalesce(sum(f.request_count),0)::bigint as requests,
      coalesce(sum(f.weighted_usage),0)::bigint as weighted,
      coalesce(sum(f.error_count),0)::bigint as errors,
      case when sum(f.latency_count)>0 then round(sum(f.total_latency_ms)::numeric/sum(f.latency_count))::integer else null end as avg_latency
    from days d left join filtered f on f.created_at::date=d.day
    group by d.day
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(day,'YYYY-MM-DD'),'requests',requests,'weightedUsage',weighted,'errors',errors,'avgLatency',avg_latency) order by day),'[]'::jsonb) as value
    from daily_rows
  ),
  services as (
    select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'name',coalesce(max(name),service_slug),'requests',requests,'weightedUsage',weighted,'errors',errors) order by requests desc),'[]'::jsonb) as value
    from (
      select f.service_slug,sum(f.request_count)::bigint as requests,sum(f.weighted_usage)::bigint as weighted,sum(f.error_count)::bigint as errors,max(s.name) as name
      from filtered f left join public.api_services s on s.slug=f.service_slug
      group by f.service_slug
    ) grouped
  ),
  users as (
    select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'name',coalesce(max(p.display_name),max(p.email),'حساب'),'email',max(p.email),'requests',requests,'weightedUsage',weighted,'errors',errors) order by weighted desc),'[]'::jsonb) as value
    from (
      select f.user_id,sum(f.request_count)::bigint as requests,sum(f.weighted_usage)::bigint as weighted,sum(f.error_count)::bigint as errors
      from filtered f group by f.user_id
    ) grouped left join public.profiles p on p.id=grouped.user_id
  ),
  statuses as (
    select coalesce(jsonb_agg(jsonb_build_object('statusCode',status_code,'requests',requests) order by status_code),'[]'::jsonb) as value
    from (select status_code,sum(request_count)::bigint as requests from filtered group by status_code) grouped
  ),
  peak_hours as (
    select coalesce(jsonb_agg(jsonb_build_object('hour',hour,'requests',requests) order by requests desc),'[]'::jsonb) as value
    from (select extract(hour from created_at)::integer as hour,sum(request_count)::bigint as requests from filtered group by 1 order by 2 desc limit 8) grouped
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'userId',user_id,'service',service_slug,'method',request_method,'status',status_code,'latency',latency_ms,'createdAt',created_at) order by created_at desc),'[]'::jsonb) as value
    from (
      select id,user_id,service_slug,request_method,status_code,latency_ms,created_at
      from private.api_usage
      where created_at>=now()-interval '24 hours'
        and (p_service is null or service_slug=p_service)
        and (p_user_id is null or user_id=p_user_id)
        and (p_status_code is null or status_code=p_status_code)
      order by created_at desc limit 20
    ) latest
  )
  select jsonb_build_object(
    'periodDays',v_days,
    'totals',jsonb_build_object(
      'requests',totals.requests,'weightedUsage',totals.weighted_usage,'errors',totals.errors,
      'successRate',case when totals.measured>0 then round((totals.successful::numeric/totals.measured)*100)::integer else null end,
      'avgLatency',case when totals.latency_count>0 then round(totals.total_latency::numeric/totals.latency_count)::integer else null end,
      'measuredRequests',totals.latency_count
    ),
    'daily',daily.value,'services',services.value,'users',users.value,
    'statuses',statuses.value,'peakHours',peak_hours.value,'recent',recent.value
  ) into v_result
  from totals cross join daily cross join services cross join users cross join statuses cross join peak_hours cross join recent;

  return v_result;
end;
$function$;

revoke all on function public.bmg_get_admin_analytics(integer,text,uuid,text,integer) from public,anon;
grant execute on function public.bmg_get_admin_analytics(integer,text,uuid,text,integer) to authenticated;

commit;