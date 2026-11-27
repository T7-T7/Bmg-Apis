begin;
do $migration$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_get_organization_usage(uuid,integer)'::regprocedure);
  if position($old$service_totals as (
    select e.service_slug,
      sum(e.request_count)::bigint as requests,
      sum(e.weighted_usage)::bigint as weighted_usage,
      greatest(1,coalesce(max(s.weight),1))::integer as weight
    from events e
    left join public.api_services s on s.slug=e.service_slug
    group by e.service_slug
  ),$old$ in v_definition)=0 then
    raise exception 'Expected service_totals definition was not found';
  end if;
  v_definition:=replace(v_definition,
$old$service_totals as (
    select e.service_slug,
      sum(e.request_count)::bigint as requests,
      sum(e.weighted_usage)::bigint as weighted_usage,
      greatest(1,coalesce(max(s.weight),1))::integer as weight
    from events e
    left join public.api_services s on s.slug=e.service_slug
    group by e.service_slug
  ),$old$,
$new$service_totals as (
    select s.slug as service_slug,
      coalesce(sum(e.request_count),0)::bigint as requests,
      coalesce(sum(e.weighted_usage),0)::bigint as weighted_usage,
      greatest(1,coalesce(s.weight,1))::integer as weight
    from public.api_services s
    left join events e on e.service_slug=s.slug
    where s.status='active' and s.archived_at is null
    group by s.slug,s.weight
  ),$new$);
  execute v_definition;
end;
$migration$;
commit;