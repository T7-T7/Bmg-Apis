create or replace function public.bmg_get_api_analytics(p_days integer default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_days integer:=greatest(1,least(coalesce(p_days,1),90));
  v_role text;
  v_plan text;
  v_daily_limit bigint;
  v_monthly_limit bigint;
  v_daily_usage bigint:=0;
  v_monthly_usage bigint:=0;
  v_daily_pct numeric;
  v_monthly_pct numeric;
  v_warnings jsonb:='[]'::jsonb;
  v_limits jsonb;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;

  select role,plan into v_role,v_plan from public.profiles where id=v_user_id;
  if v_role in ('admin','owner') then
    select daily_weighted_limit,monthly_weighted_limit into v_daily_limit,v_monthly_limit
    from public.api_admin_limits where id=true;
  else
    select daily_weighted_limit,monthly_weighted_limit into v_daily_limit,v_monthly_limit
    from public.api_plan_limits where plan=coalesce(v_plan,'basic');
  end if;
  v_daily_limit:=coalesce(v_daily_limit,1000);
  v_monthly_limit:=coalesce(v_monthly_limit,20000);

  select coalesce(sum(weighted_usage),0)::bigint into v_daily_usage
  from (
    select weighted_usage from private.api_usage_hourly
    where user_id=v_user_id and bucket_hour>=date_trunc('day',now())
    union all
    select greatest(1,coalesce(service_weight,1))::bigint from private.api_usage
    where user_id=v_user_id and created_at>=date_trunc('day',now()) and aggregated_at is null
  ) usage_rows;

  select coalesce(sum(weighted_usage),0)::bigint into v_monthly_usage
  from (
    select weighted_usage from private.api_usage_hourly
    where user_id=v_user_id and bucket_hour>=date_trunc('month',now())
    union all
    select greatest(1,coalesce(service_weight,1))::bigint from private.api_usage
    where user_id=v_user_id and created_at>=date_trunc('month',now()) and aggregated_at is null
  ) usage_rows;

  v_daily_pct:=round((v_daily_usage::numeric/nullif(v_daily_limit,0))*100,1);
  v_monthly_pct:=round((v_monthly_usage::numeric/nullif(v_monthly_limit,0))*100,1);

  if v_daily_pct>=80 then
    v_warnings:=v_warnings||jsonb_build_array(jsonb_build_object('period','daily','percentage',v_daily_pct,'level',case when v_daily_pct>=100 then 'critical' when v_daily_pct>=95 then 'warning' else 'info' end));
  end if;
  if v_monthly_pct>=80 then
    v_warnings:=v_warnings||jsonb_build_array(jsonb_build_object('period','monthly','percentage',v_monthly_pct,'level',case when v_monthly_pct>=100 then 'critical' when v_monthly_pct>=95 then 'warning' else 'info' end));
  end if;

  v_limits:=jsonb_build_object(
    'plan',coalesce(v_plan,'basic'),
    'dailyWeightedLimit',v_daily_limit,'monthlyWeightedLimit',v_monthly_limit,
    'dailyWeightedUsage',v_daily_usage,'monthlyWeightedUsage',v_monthly_usage,
    'dailyPercentage',v_daily_pct,'monthlyPercentage',v_monthly_pct,
    'warnings',v_warnings
  );

  with events as (
    select h.service_slug,h.status_code,h.request_count,h.success_count,h.error_count,
           h.latency_count,h.total_latency_ms,h.weighted_usage,h.bucket_hour as created_at
    from private.api_usage_hourly h
    where h.user_id=v_user_id and h.bucket_hour>=now()-make_interval(days=>v_days)
    union all
    select u.service_slug,coalesce(u.status_code,0)::smallint,1::bigint,
           case when u.status_code between 200 and 399 then 1 else 0 end::bigint,
           case when u.status_code>=400 then 1 else 0 end::bigint,
           case when u.latency_ms is not null then 1 else 0 end::bigint,
           coalesce(u.latency_ms,0)::bigint,
           greatest(1,coalesce(u.service_weight,1))::bigint,u.created_at
    from private.api_usage u
    where u.user_id=v_user_id and u.created_at>=now()-make_interval(days=>v_days) and u.aggregated_at is null
  ),
  totals as (
    select coalesce(sum(request_count),0)::bigint as requests,
      coalesce(sum(request_count) filter(where status_code>0),0)::bigint as status_measured,
      coalesce(sum(success_count),0)::bigint as successful,
      coalesce(sum(error_count),0)::bigint as errors,
      coalesce(sum(latency_count),0)::bigint as measured,
      coalesce(sum(total_latency_ms),0)::bigint as total_latency,
      coalesce(sum(weighted_usage),0)::bigint as weighted_usage
    from events
  ),
  days as (select (current_date-(v_days-1)+n)::date as day from generate_series(0,v_days-1) as n),
  daily_rows as (
    select days.day,coalesce(sum(events.request_count),0)::bigint as request_count,
      coalesce(sum(events.weighted_usage),0)::bigint as weighted_usage
    from days left join events on events.created_at::date=days.day group by days.day
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(day,'YYYY-MM-DD'),'count',request_count,'weightedUsage',weighted_usage) order by day),'[]'::jsonb) as value from daily_rows
  ),
  services as (
    select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'count',total,'weightedUsage',weighted) order by total desc),'[]'::jsonb) as value
    from (select service_slug,sum(request_count)::bigint as total,sum(weighted_usage)::bigint as weighted from events group by service_slug) grouped
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'service',service_slug,'method',request_method,'status',status_code,'latency',latency_ms,'createdAt',created_at) order by created_at desc),'[]'::jsonb) as value
    from (select * from private.api_usage where user_id=v_user_id order by created_at desc limit 12) latest
  )
  select jsonb_build_object(
    'periodDays',v_days,'limits',v_limits,
    'totals',jsonb_build_object(
      'requests',totals.requests,'weightedUsage',totals.weighted_usage,'errors',totals.errors,
      'successRate',case when totals.status_measured>0 then round((totals.successful::numeric/totals.status_measured)*100)::integer else null end,
      'avgLatency',case when totals.measured>0 then round(totals.total_latency::numeric/totals.measured)::integer else null end,
      'measuredRequests',totals.measured
    ),
    'daily',daily.value,'services',services.value,'recent',recent.value
  ) into v_result from totals cross join daily cross join services cross join recent;

  return v_result;
end;
$function$;