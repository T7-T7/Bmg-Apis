begin;

alter table public.api_services
  add column if not exists weight integer not null default 1;
alter table public.api_services
  drop constraint if exists api_services_weight_check,
  add constraint api_services_weight_check check (weight between 1 and 100);

alter table private.api_usage
  add column if not exists service_weight integer not null default 1,
  add column if not exists aggregated_at timestamptz;

create index if not exists api_usage_pending_aggregation_idx
  on private.api_usage(created_at) where aggregated_at is null;

create table if not exists private.api_usage_hourly (
  bucket_hour timestamptz not null,
  user_id uuid not null,
  service_slug text not null,
  status_code smallint not null default 0,
  request_count bigint not null default 0,
  success_count bigint not null default 0,
  error_count bigint not null default 0,
  latency_count bigint not null default 0,
  total_latency_ms bigint not null default 0,
  weighted_usage bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(bucket_hour,user_id,service_slug,status_code)
);

create index if not exists api_usage_hourly_user_bucket_idx
  on private.api_usage_hourly(user_id,bucket_hour desc);
create index if not exists api_usage_hourly_service_bucket_idx
  on private.api_usage_hourly(service_slug,bucket_hour desc);

alter table private.api_usage_hourly enable row level security;

create or replace function private.bmg_aggregate_api_usage()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  with pending as materialized (
    select u.id,u.user_id,u.service_slug,coalesce(u.status_code,0)::smallint as status_code,
           u.latency_ms,u.service_weight,date_trunc('hour',u.created_at) as bucket_hour
    from private.api_usage u
    where u.aggregated_at is null
      and u.created_at < now() - interval '10 minutes'
    order by u.created_at
    limit 20000
    for update skip locked
  ),
  grouped as (
    select bucket_hour,user_id,service_slug,status_code,
      count(*)::bigint as request_count,
      count(*) filter(where status_code between 200 and 399)::bigint as success_count,
      count(*) filter(where status_code >= 400)::bigint as error_count,
      count(latency_ms)::bigint as latency_count,
      coalesce(sum(latency_ms),0)::bigint as total_latency_ms,
      coalesce(sum(service_weight),0)::bigint as weighted_usage
    from pending
    group by bucket_hour,user_id,service_slug,status_code
  ),
  upserted as (
    insert into private.api_usage_hourly(
      bucket_hour,user_id,service_slug,status_code,request_count,success_count,error_count,
      latency_count,total_latency_ms,weighted_usage,updated_at
    )
    select bucket_hour,user_id,service_slug,status_code,request_count,success_count,error_count,
      latency_count,total_latency_ms,weighted_usage,now()
    from grouped
    on conflict(bucket_hour,user_id,service_slug,status_code) do update
    set request_count=private.api_usage_hourly.request_count+excluded.request_count,
        success_count=private.api_usage_hourly.success_count+excluded.success_count,
        error_count=private.api_usage_hourly.error_count+excluded.error_count,
        latency_count=private.api_usage_hourly.latency_count+excluded.latency_count,
        total_latency_ms=private.api_usage_hourly.total_latency_ms+excluded.total_latency_ms,
        weighted_usage=private.api_usage_hourly.weighted_usage+excluded.weighted_usage,
        updated_at=now()
    returning 1
  )
  update private.api_usage u
  set aggregated_at=now()
  from pending p
  where u.id=p.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.bmg_aggregate_api_usage() from public,anon,authenticated;

create or replace function public.bmg_authorize_api_request(p_key text, p_service_slug text, p_method text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','extensions'
as $function$
declare
  found_key private.api_keys%rowtype;
  service_status text;
  service_id uuid;
  service_archived boolean;
  service_weight integer;
  account_status text;
  maintenance_message text;
  recent_count integer;
  usage_id bigint;
begin
  if p_key is null or length(p_key) < 40 then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_key');
  end if;

  select * into found_key
  from private.api_keys
  where key_hash = extensions.digest(p_key, 'sha256')
    and revoked_at is null
    and (expires_at is null or expires_at > now())
    and scopes @> array['api:use']::text[]
  limit 1;

  if found_key.id is null then
    return jsonb_build_object('authorized', false, 'reason', 'invalid_key');
  end if;

  select p.account_status into account_status
  from public.profiles p
  where p.id=found_key.user_id;

  if account_status is distinct from 'active' then
    return jsonb_build_object('authorized',false,'reason','account_suspended');
  end if;

  select s.id,s.status,(s.archived_at is not null),s.weight
    into service_id,service_status,service_archived,service_weight
  from public.api_services s
  where s.slug=p_service_slug;

  if service_status is distinct from 'active' or coalesce(service_archived,true) then
    return jsonb_build_object('authorized', false, 'reason', 'service_unavailable');
  end if;

  select m.message into maintenance_message
  from public.maintenance_windows m
  where m.enabled=true
    and (m.service_id is null or m.service_id=service_id)
    and (m.starts_at is null or m.starts_at<=now())
    and (m.ends_at is null or m.ends_at>now())
  order by (m.service_id is not null) desc,m.updated_at desc
  limit 1;

  if maintenance_message is not null then
    return jsonb_build_object('authorized',false,'reason','maintenance','message',maintenance_message);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(found_key.id::text, 0));

  select count(*) into recent_count
  from private.api_usage
  where api_key_id = found_key.id and created_at > now() - interval '1 minute';

  if recent_count >= 30 then
    return jsonb_build_object('authorized', false, 'reason', 'rate_limited');
  end if;

  if pg_try_advisory_xact_lock(hashtextextended('nox_api_usage_retention_24h', 0)) then
    delete from private.api_usage where created_at < now() - interval '24 hours' and aggregated_at is not null;
  end if;

  update private.api_keys set last_used_at = now() where id = found_key.id;
  insert into private.api_usage(api_key_id,user_id,service_slug,request_method,service_weight)
  values(found_key.id,found_key.user_id,p_service_slug,upper(coalesce(p_method,'POST')),greatest(1,coalesce(service_weight,1)))
  returning id into usage_id;

  return jsonb_build_object('authorized', true, 'usage_id', usage_id);
end;
$function$;

create or replace function public.bmg_get_api_analytics(p_days integer default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_days integer := greatest(1,least(coalesce(p_days,1),90));
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  with events as (
    select h.service_slug,h.status_code,h.request_count,h.success_count,h.error_count,
           h.latency_count,h.total_latency_ms,h.weighted_usage,h.bucket_hour as created_at
    from private.api_usage_hourly h
    where h.user_id=v_user_id
      and h.bucket_hour >= now() - make_interval(days=>v_days)
    union all
    select u.service_slug,coalesce(u.status_code,0)::smallint,1::bigint,
           case when u.status_code between 200 and 399 then 1 else 0 end::bigint,
           case when u.status_code>=400 then 1 else 0 end::bigint,
           case when u.latency_ms is not null then 1 else 0 end::bigint,
           coalesce(u.latency_ms,0)::bigint,
           greatest(1,coalesce(u.service_weight,1))::bigint,
           u.created_at
    from private.api_usage u
    where u.user_id=v_user_id
      and u.created_at >= now() - make_interval(days=>v_days)
      and u.aggregated_at is null
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
  days as (
    select (current_date - (v_days - 1) + n)::date as day
    from generate_series(0,v_days-1) as n
  ),
  daily_rows as (
    select days.day,coalesce(sum(events.request_count),0)::bigint as request_count,
      coalesce(sum(events.weighted_usage),0)::bigint as weighted_usage
    from days left join events on events.created_at::date=days.day
    group by days.day
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',to_char(day,'YYYY-MM-DD'),'count',request_count,'weightedUsage',weighted_usage
    ) order by day),'[]'::jsonb) as value from daily_rows
  ),
  services as (
    select coalesce(jsonb_agg(jsonb_build_object('slug',service_slug,'count',total,'weightedUsage',weighted)
      order by total desc),'[]'::jsonb) as value
    from (
      select service_slug,sum(request_count)::bigint as total,sum(weighted_usage)::bigint as weighted
      from events group by service_slug
    ) grouped
  ),
  recent as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'service',service_slug,'method',request_method,'status',status_code,
      'latency',latency_ms,'createdAt',created_at
    ) order by created_at desc),'[]'::jsonb) as value
    from (select * from private.api_usage where user_id=v_user_id order by created_at desc limit 12) latest
  )
  select jsonb_build_object(
    'periodDays',v_days,
    'totals',jsonb_build_object(
      'requests',totals.requests,
      'weightedUsage',totals.weighted_usage,
      'errors',totals.errors,
      'successRate',case when totals.status_measured>0 then round((totals.successful::numeric/totals.status_measured)*100)::integer else null end,
      'avgLatency',case when totals.measured>0 then round(totals.total_latency::numeric/totals.measured)::integer else null end,
      'measuredRequests',totals.measured
    ),
    'daily',daily.value,'services',services.value,'recent',recent.value
  ) into v_result
  from totals cross join daily cross join services cross join recent;

  return v_result;
end;
$function$;

select cron.unschedule(jobid) from cron.job where jobname='bmg-api-usage-retention-24h';
select cron.schedule(
  'bmg-api-usage-retention-24h',
  '15 * * * *',
  'delete from private.api_usage where created_at < now() - interval ''24 hours'' and aggregated_at is not null'
);
select cron.schedule(
  'bmg-api-usage-aggregation',
  '5,10,20,30,40,50 * * * *',
  'select private.bmg_aggregate_api_usage()'
);

commit;