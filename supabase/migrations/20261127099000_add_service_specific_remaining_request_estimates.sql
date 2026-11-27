begin;
do $migration$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_get_organization_usage(uuid,integer)'::regprocedure);

  if position($old$service_totals as (
    select service_slug,sum(request_count)::bigint as requests,sum(weighted_usage)::bigint as weighted_usage
    from events group by service_slug
  ),$old$ in v_definition)=0 then
    raise exception 'Expected service_totals definition was not found';
  end if;

  if position($old$'services',(select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'requests',requests,'weightedUsage',weighted_usage) order by weighted_usage desc),'[]'::jsonb) from service_totals),$old$ in v_definition)=0 then
    raise exception 'Expected services JSON definition was not found';
  end if;

  v_definition:=replace(v_definition,
$old$service_totals as (
    select service_slug,sum(request_count)::bigint as requests,sum(weighted_usage)::bigint as weighted_usage
    from events group by service_slug
  ),$old$,
$new$service_totals as (
    select e.service_slug,
      sum(e.request_count)::bigint as requests,
      sum(e.weighted_usage)::bigint as weighted_usage,
      greatest(1,coalesce(max(s.weight),1))::integer as weight
    from events e
    left join public.api_services s on s.slug=e.service_slug
    group by e.service_slug
  ),$new$);

  v_definition:=replace(v_definition,
$old$'services',(select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'requests',requests,'weightedUsage',weighted_usage) order by weighted_usage desc),'[]'::jsonb) from service_totals),$old$,
$new$'services',(select coalesce(jsonb_agg(jsonb_build_object(
      'slug',service_slug,
      'requests',requests,
      'weightedUsage',weighted_usage,
      'weight',weight,
      'dailyRemainingRequests',case when v_allocation.daily_weighted_limit is null then null else greatest(0,floor(greatest(0,v_allocation.daily_weighted_limit-v_daily_usage)::numeric/weight)::bigint) end,
      'monthlyRemainingRequests',case when v_allocation.monthly_weighted_limit is null then null else greatest(0,floor(greatest(0,v_allocation.monthly_weighted_limit-v_monthly_usage)::numeric/weight)::bigint) end
    ) order by weighted_usage desc),'[]'::jsonb) from service_totals),$new$);

  execute v_definition;
end;
$migration$;
commit;