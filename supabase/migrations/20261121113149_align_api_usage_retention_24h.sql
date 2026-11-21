create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function public.bmg_get_api_analytics(p_days integer default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_days integer := 1;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  with events as (
    select id, service_slug, request_method, status_code, latency_ms, created_at
    from private.api_usage
    where user_id = v_user_id and created_at >= now() - interval '24 hours'
  ),
  totals as (
    select count(*)::integer as requests,
      count(*) filter (where status_code is not null)::integer as status_measured,
      count(*) filter (where status_code >= 200 and status_code < 400)::integer as successful,
      count(*) filter (where latency_ms is not null)::integer as measured,
      round(avg(latency_ms))::integer as avg_latency
    from events
  ),
  days as (
    select (current_date - (v_days - 1) + n)::date as day
    from generate_series(0, v_days - 1) as n
  ),
  daily_rows as (
    select days.day, count(events.id)::integer as request_count
    from days left join events on events.created_at::date = days.day
    group by days.day
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object('date',to_char(day,'YYYY-MM-DD'),'count',request_count) order by day),'[]'::jsonb) as value
    from daily_rows
  ),
  services as (
    select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'count',total) order by total desc),'[]'::jsonb) as value
    from (select service_slug,count(*)::integer as total from events group by service_slug) grouped
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'service',service_slug,'method',request_method,'status',status_code,'latency',latency_ms,'createdAt',created_at) order by created_at desc),'[]'::jsonb) as value
    from (select * from events order by created_at desc limit 12) latest
  )
  select jsonb_build_object(
    'totals',jsonb_build_object('requests',totals.requests,'successRate',case when totals.status_measured>0 then round((totals.successful::numeric/totals.status_measured)*100)::integer else null end,'avgLatency',totals.avg_latency,'measuredRequests',totals.measured),
    'daily',daily.value,'services',services.value,'recent',recent.value
  ) into v_result from totals cross join daily cross join services cross join recent;

  return v_result;
end;
$function$;

create or replace function public.bmg_get_api_request_logs(
  p_page integer default 1,
  p_page_size integer default 25,
  p_service text default null,
  p_status text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(greatest(coalesce(p_page_size,25),1),100);
  v_total bigint;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  if p_status not in ('all','success','error') then
    raise exception 'invalid_status_filter' using errcode='22023';
  end if;

  with filtered as (
    select u.id,u.service_slug as service,u.request_method as method,
      u.status_code as status,u.latency_ms as latency,u.created_at as "createdAt",
      k.label as key_label,k.key_prefix
    from private.api_usage u
    left join private.api_keys k on k.id=u.api_key_id
    where u.user_id=v_user_id
      and u.created_at>=now()-interval '24 hours'
      and (p_service is null or p_service='all' or u.service_slug=p_service)
      and (p_status='all' or (p_status='success' and u.status_code>=200 and u.status_code<400)
        or (p_status='error' and (u.status_code is null or u.status_code>=400)))
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select u.id,u.service_slug as service,u.request_method as method,
      u.status_code as status,u.latency_ms as latency,u.created_at as "createdAt",
      k.label as key_label,k.key_prefix
    from private.api_usage u
    left join private.api_keys k on k.id=u.api_key_id
    where u.user_id=v_user_id
      and u.created_at>=now()-interval '24 hours'
      and (p_service is null or p_service='all' or u.service_slug=p_service)
      and (p_status='all' or (p_status='success' and u.status_code>=200 and u.status_code<400)
        or (p_status='error' and (u.status_code is null or u.status_code>=400)))
    order by u.created_at desc,u.id desc
    offset (v_page-1)*v_page_size limit v_page_size
  )
  select coalesce(jsonb_agg(to_jsonb(filtered)),'[]'::jsonb) into v_items from filtered;

  return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_page_size,
    'totalPages',greatest(1,ceil(v_total::numeric/v_page_size)::integer));
end;
$function$;

select cron.schedule('bmg-api-usage-retention-24h','15 * * * *',
  $$delete from private.api_usage where created_at < now() - interval '24 hours'$$);
