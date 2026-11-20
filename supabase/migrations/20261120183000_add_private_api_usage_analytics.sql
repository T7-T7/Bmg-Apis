create or replace function public.bmg_get_api_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_user_id uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 90);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  with events as (
    select id, service_slug, request_method, status_code, latency_ms, created_at
    from private.api_usage
    where user_id = v_user_id
      and created_at >= now() - make_interval(days => v_days)
  ),
  totals as (
    select
      count(*)::integer as requests,
      count(*) filter (where status_code >= 200 and status_code < 400)::integer as successful,
      count(*) filter (where latency_ms is not null)::integer as measured,
      round(avg(latency_ms))::integer as avg_latency
    from events
  ),
  days as (
    select (current_date - (v_days - 1) + n)::date as day
    from generate_series(0, v_days - 1) as n
  ),
  daily as (
    select jsonb_agg(jsonb_build_object(
      'date', to_char(days.day, 'YYYY-MM-DD'),
      'count', count(events.id)
    ) order by days.day) as value
    from days
    left join events on events.created_at::date = days.day
    group by true
  ),
  services as (
    select coalesce(jsonb_agg(jsonb_build_object('slug', service_slug, 'count', total) order by total desc), '[]'::jsonb) as value
    from (
      select service_slug, count(*)::integer as total
      from events group by service_slug
    ) grouped
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'service', service_slug, 'method', request_method,
      'status', status_code, 'latency', latency_ms, 'createdAt', created_at
    ) order by created_at desc), '[]'::jsonb) as value
    from (select * from events order by created_at desc limit 12) latest
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'requests', totals.requests,
      'successRate', case when totals.requests > 0 then round((totals.successful::numeric / totals.requests) * 100)::integer else null end,
      'avgLatency', totals.avg_latency,
      'measuredRequests', totals.measured
    ),
    'daily', coalesce(daily.value, '[]'::jsonb),
    'services', services.value,
    'recent', recent.value
  ) into v_result
  from totals cross join daily cross join services cross join recent;

  return v_result;
end;
$function$;

revoke all on function public.bmg_get_api_analytics(integer) from public, anon;
grant execute on function public.bmg_get_api_analytics(integer) to authenticated;
