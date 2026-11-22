begin;

create or replace function private.bmg_report_next_run(
  p_frequency text,
  p_timezone text,
  p_hour integer,
  p_minute integer,
  p_weekday integer,
  p_monthday integer,
  p_after timestamptz default now()
) returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local timestamp;
  v_candidate timestamp;
  v_tz text := coalesce(nullif(p_timezone,''),'UTC');
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_tz) then
    raise exception 'Invalid report timezone';
  end if;
  if p_frequency not in ('daily','weekly','monthly') then return null; end if;
  v_local := p_after at time zone v_tz;
  v_candidate := date_trunc('day',v_local) + make_interval(hours=>p_hour,mins=>p_minute);
  if p_frequency='daily' then
    if v_candidate <= v_local then v_candidate := v_candidate + interval '1 day'; end if;
  elsif p_frequency='weekly' then
    v_candidate := date_trunc('week',v_local)
      + make_interval(days=>greatest(0,least(6,p_weekday-1)),hours=>p_hour,mins=>p_minute);
    if v_candidate <= v_local then v_candidate := v_candidate + interval '7 days'; end if;
  else
    v_candidate := date_trunc('month',v_local)
      + make_interval(days=>greatest(0,least(27,p_monthday-1)),hours=>p_hour,mins=>p_minute);
    if v_candidate <= v_local then
      v_candidate := date_trunc('month',v_local + interval '1 month')
        + make_interval(days=>greatest(0,least(27,p_monthday-1)),hours=>p_hour,mins=>p_minute);
    end if;
  end if;
  return v_candidate at time zone v_tz;
end;
$$;

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  description text not null default '',
  frequency text not null default 'manual' check (frequency in ('manual','daily','weekly','monthly')),
  period_days integer not null default 7 check (period_days in (1,7,30,90)),
  timezone text not null default 'UTC',
  schedule_hour smallint not null default 9 check (schedule_hour between 0 and 23),
  schedule_minute smallint not null default 0 check (schedule_minute between 0 and 59),
  schedule_weekday smallint not null default 1 check (schedule_weekday between 1 and 7),
  schedule_monthday smallint not null default 1 check (schedule_monthday between 1 and 28),
  sections text[] not null default array['overview','usage','performance','errors','services','users']::text[],
  filters jsonb not null default '{}'::jsonb,
  recipient_ids uuid[] not null default '{}'::uuid[],
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_templates_sections_check check (
    sections <@ array['overview','usage','performance','errors','services','users','peak_hours','status_codes']::text[]
    and cardinality(sections) > 0
  ),
  constraint report_templates_timezone_check check (length(timezone) between 1 and 80)
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.report_templates(id) on delete set null,
  template_name text not null,
  trigger_type text not null check (trigger_type in ('manual','scheduled')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  period_days integer not null check (period_days in (1,7,30,90)),
  timezone text not null default 'UTC',
  sections text[] not null,
  filters jsonb not null default '{}'::jsonb,
  recipient_ids uuid[] not null default '{}'::uuid[],
  report_data jsonb,
  executive_summary text,
  data_quality jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  email_status text not null default 'not_configured' check (email_status in ('not_requested','not_configured','pending','sent','failed')),
  email_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.report_run_attempts (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.report_runs(id) on delete cascade,
  attempt_number integer not null,
  status text not null check (status in ('started','succeeded','partial','failed')),
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists report_templates_due_idx
  on public.report_templates(next_run_at) where enabled and frequency <> 'manual';
create index if not exists report_runs_queue_idx
  on public.report_runs(status,created_at) where status in ('queued','running');
create index if not exists report_runs_created_idx on public.report_runs(created_at desc);
create index if not exists report_attempts_report_idx on public.report_run_attempts(report_id,created_at desc);

alter table public.report_templates enable row level security;
alter table public.report_runs enable row level security;
alter table public.report_run_attempts enable row level security;

drop policy if exists "admins manage report templates" on public.report_templates;
create policy "admins manage report templates" on public.report_templates
  for all to authenticated using ((select private.bmg_is_admin()))
  with check ((select private.bmg_is_admin()));
drop policy if exists "admins manage report runs" on public.report_runs;
create policy "admins manage report runs" on public.report_runs
  for all to authenticated using ((select private.bmg_is_admin()))
  with check ((select private.bmg_is_admin()));
drop policy if exists "admins read report attempts" on public.report_run_attempts;
create policy "admins read report attempts" on public.report_run_attempts
  for select to authenticated using ((select private.bmg_is_admin()));

grant select,insert,update,delete on public.report_templates to authenticated;
grant select,delete on public.report_runs to authenticated;
grant select on public.report_run_attempts to authenticated;
revoke insert,update on public.report_runs from anon,authenticated;
revoke insert,update,delete on public.report_run_attempts from anon,authenticated;

create or replace function private.bmg_report_template_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
    raise exception 'Invalid report timezone';
  end if;
  if new.frequency='manual' or not new.enabled then
    new.next_run_at := null;
  elsif tg_op='INSERT' or old.frequency is distinct from new.frequency
    or old.timezone is distinct from new.timezone
    or old.schedule_hour is distinct from new.schedule_hour
    or old.schedule_minute is distinct from new.schedule_minute
    or old.schedule_weekday is distinct from new.schedule_weekday
    or old.schedule_monthday is distinct from new.schedule_monthday
    or old.enabled is distinct from new.enabled then
    new.next_run_at := private.bmg_report_next_run(
      new.frequency,new.timezone,new.schedule_hour,new.schedule_minute,
      new.schedule_weekday,new.schedule_monthday,now()
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists report_template_schedule on public.report_templates;
create trigger report_template_schedule
before insert or update on public.report_templates
for each row execute function private.bmg_report_template_schedule();

create or replace function public.bmg_admin_queue_report(
  p_template_id uuid,
  p_period_days integer default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.report_templates%rowtype;
  v_id uuid := gen_random_uuid();
  v_days integer;
begin
  if auth.uid() is null or not private.bmg_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  select * into v_template from public.report_templates where id=p_template_id;
  if not found then raise exception 'Report template not found'; end if;
  v_days := coalesce(p_period_days,v_template.period_days);
  if v_days not in (1,7,30,90) then raise exception 'Invalid report period'; end if;
  insert into public.report_runs(
    id,template_id,template_name,trigger_type,status,period_start,period_end,
    period_days,timezone,sections,filters,recipient_ids,created_by
  ) values (
    v_id,v_template.id,v_template.name,'manual','queued',
    now()-make_interval(days=>v_days),now(),v_days,v_template.timezone,
    v_template.sections,v_template.filters,v_template.recipient_ids,auth.uid()
  );
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'report.queue','report_run',v_id::text,
    jsonb_build_object('templateId',v_template.id,'templateName',v_template.name,'periodDays',v_days));
  return v_id;
end;
$$;
revoke all on function public.bmg_admin_queue_report(uuid,integer) from public,anon;
grant execute on function public.bmg_admin_queue_report(uuid,integer) to authenticated;

create or replace function private.bmg_reports_process_queue()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.report_runs%rowtype;
  v_processed integer := 0;
  v_data jsonb;
  v_previous jsonb;
  v_quality jsonb;
  v_filters jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_prev_requests bigint := 0;
  v_prev_weighted bigint := 0;
  v_measured bigint := 0;
  v_service text;
  v_user uuid;
  v_category text;
  v_status integer;
  v_requests bigint;
  v_weighted bigint;
  v_errors bigint;
  v_success bigint;
  v_latency_count bigint;
  v_latency_total bigint;
  v_coverage timestamptz;
  v_hourly jsonb;
  v_daily jsonb;
  v_services jsonb;
  v_users jsonb;
  v_statuses jsonb;
  v_peak jsonb;
  v_summary text;
  v_partial boolean;
  v_error text;
  v_admin_id uuid;
begin
  for v_run in
    select * from public.report_runs
    where status in ('queued','running')
      and attempts < max_attempts
      and (status='queued' or started_at < now()-interval '10 minutes')
    order by created_at
    for update skip locked
    limit 5
  loop
    v_processed := v_processed + 1;
    update public.report_runs
      set status='running',attempts=attempts+1,started_at=now(),last_error=null
      where id=v_run.id;
    insert into public.report_run_attempts(report_id,attempt_number,status,message)
      values(v_run.id,v_run.attempts+1,'started','بدأ إنشاء التقرير');
    begin
      v_start := v_run.period_start;
      v_end := v_run.period_end;
      v_prev_start := v_start - (v_end-v_start);
      v_prev_end := v_start;
      v_filters := coalesce(v_run.filters,'{}'::jsonb);
      v_service := nullif(v_filters->>'service','');
      v_user := nullif(v_filters->>'user_id','')::uuid;
      v_category := nullif(v_filters->>'category','');
      v_status := nullif(v_filters->>'status_code','')::integer;

      with events as (
        select h.user_id,h.service_slug,h.status_code,h.request_count,h.success_count,h.error_count,
          h.latency_count,h.total_latency_ms,h.weighted_usage,h.bucket_hour as created_at
        from private.api_usage_hourly h
        where h.bucket_hour >= v_prev_start and h.bucket_hour < v_end
        union all
        select u.user_id,u.service_slug,coalesce(u.status_code,0)::smallint,1::bigint,
          case when u.status_code between 200 and 399 then 1 else 0 end::bigint,
          case when u.status_code>=400 then 1 else 0 end::bigint,
          case when u.latency_ms is not null then 1 else 0 end::bigint,
          coalesce(u.latency_ms,0)::bigint,greatest(1,coalesce(u.service_weight,1))::bigint,u.created_at
        from private.api_usage u
        where u.created_at >= v_prev_start and u.created_at < v_end and u.aggregated_at is null
      ), filtered as (
        select e.* from events e
        left join public.api_services s on s.slug=e.service_slug
        where (v_service is null or e.service_slug=v_service)
          and (v_user is null or e.user_id=v_user)
          and (v_category is null or s.category=v_category)
          and (v_status is null or e.status_code=v_status)
      )
      select
        coalesce(sum(request_count) filter(where created_at>=v_start),0)::bigint,
        coalesce(sum(weighted_usage) filter(where created_at>=v_start),0)::bigint,
        coalesce(sum(error_count) filter(where created_at>=v_start),0)::bigint,
        coalesce(sum(success_count) filter(where created_at>=v_start),0)::bigint,
        coalesce(sum(latency_count) filter(where created_at>=v_start),0)::bigint,
        coalesce(sum(total_latency_ms) filter(where created_at>=v_start),0)::bigint,
        coalesce(sum(request_count) filter(where created_at>=v_start and status_code>0),0)::bigint,
        coalesce(sum(request_count) filter(where created_at<v_start),0)::bigint,
        coalesce(sum(weighted_usage) filter(where created_at<v_start),0)::bigint
      into v_requests,v_weighted,v_errors,v_success,v_latency_count,v_latency_total,v_measured,v_prev_requests,v_prev_weighted
      from filtered;

      with events as (
        select h.user_id,h.service_slug,h.status_code,h.request_count,h.success_count,h.error_count,
          h.latency_count,h.total_latency_ms,h.weighted_usage,h.bucket_hour as created_at
        from private.api_usage_hourly h
        where h.bucket_hour >= v_start and h.bucket_hour < v_end
        union all
        select u.user_id,u.service_slug,coalesce(u.status_code,0)::smallint,1::bigint,
          case when u.status_code between 200 and 399 then 1 else 0 end::bigint,
          case when u.status_code>=400 then 1 else 0 end::bigint,
          case when u.latency_ms is not null then 1 else 0 end::bigint,
          coalesce(u.latency_ms,0)::bigint,greatest(1,coalesce(u.service_weight,1))::bigint,u.created_at
        from private.api_usage u
        where u.created_at >= v_start and u.created_at < v_end and u.aggregated_at is null
      ), filtered as (
        select e.*,s.category,s.name as service_name
        from events e left join public.api_services s on s.slug=e.service_slug
        where (v_service is null or e.service_slug=v_service)
          and (v_user is null or e.user_id=v_user)
          and (v_category is null or s.category=v_category)
          and (v_status is null or e.status_code=v_status)
      ),
      hourly as (
        select date_trunc('hour',created_at) as hour,sum(request_count)::bigint as requests,
          sum(weighted_usage)::bigint as weighted
        from filtered group by 1 order by 1
      ),
      daily as (
        select date_trunc('day',created_at) as day,sum(request_count)::bigint as requests,
          sum(weighted_usage)::bigint as weighted,sum(error_count)::bigint as errors
        from filtered group by 1 order by 1
      ),
      services as (
        select service_slug,max(service_name) as name,sum(request_count)::bigint as requests,
          sum(weighted_usage)::bigint as weighted,sum(error_count)::bigint as errors
        from filtered group by service_slug order by sum(request_count) desc
      ),
      users as (
        select f.user_id,coalesce(max(p.display_name),max(p.email),'حساب') as name,
          max(p.email) as email,sum(f.request_count)::bigint as requests,
          sum(f.weighted_usage)::bigint as weighted,sum(f.error_count)::bigint as errors
        from filtered f left join public.profiles p on p.id=f.user_id
        group by f.user_id order by sum(f.weighted_usage) desc
      ),
      statuses as (
        select status_code,sum(request_count)::bigint as requests
        from filtered group by status_code order by status_code
      ),
      peak as (
        select extract(hour from created_at at time zone v_run.timezone)::integer as hour,
          sum(request_count)::bigint as requests
        from filtered group by 1 order by 2 desc limit 8
      )
      select
        coalesce((select jsonb_agg(jsonb_build_object('hour',to_char(hour,'YYYY-MM-DD"T"HH24:00'),'requests',requests,'weightedUsage',weighted) order by hour) from hourly),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('date',to_char(day,'YYYY-MM-DD'),'requests',requests,'weightedUsage',weighted,'errors',errors) order by day) from daily),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('slug',service_slug,'name',coalesce(name,service_slug),'requests',requests,'weightedUsage',weighted,'errors',errors) order by requests desc) from services),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'name',name,'email',email,'requests',requests,'weightedUsage',weighted,'errors',errors) order by weighted desc) from users),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('statusCode',status_code,'requests',requests) order by status_code) from statuses),'[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('hour',hour,'requests',requests) order by requests desc) from peak),'[]'::jsonb)
      into v_hourly,v_daily,v_services,v_users,v_statuses,v_peak;

      select min(bucket_hour) into v_coverage from private.api_usage_hourly;
      v_partial := v_coverage is null or v_coverage > date_trunc('hour',v_start);
      v_quality := jsonb_build_object(
        'partial',v_partial,
        'coverageStart',v_coverage,
        'source','private.api_usage_hourly + unaggregated private.api_usage',
        'note',case when v_partial then 'لا تتوفر تغطية تاريخية مؤكدة لكامل الفترة المطلوبة؛ تم إنشاء تقرير جزئي من البيانات المتاحة.' else 'تغطية الفترة متاحة وفق سجل التجميع الساعي.' end
      );
      v_summary := format(
        'خلال الفترة: %s طلب فعلي، %s استخدام موزون، %s خطأ، ومتوسط زمن استجابة %s ms. مقارنة بالفترة السابقة: %s طلب.',
        v_requests,v_weighted,v_errors,
        case when v_latency_count>0 then round(v_latency_total::numeric/v_latency_count)::text else 'غير متاح' end,
        coalesce(v_prev_requests,0)
      );
      v_data := jsonb_build_object(
        'overview',jsonb_build_object(
          'requests',v_requests,'weightedUsage',v_weighted,'errors',v_errors,
          'successRate',case when v_measured>0 then round((v_success::numeric/v_measured)*100)::integer else null end,
          'avgLatency',case when v_latency_count>0 then round(v_latency_total::numeric/v_latency_count)::integer else null end
        ),
        'usage',jsonb_build_object('hourly',v_hourly,'daily',v_daily),
        'performance',jsonb_build_object('avgLatency',case when v_latency_count>0 then round(v_latency_total::numeric/v_latency_count)::integer else null end,'measuredRequests',v_latency_count),
        'errors',jsonb_build_object('total',v_errors,'statusCodes',v_statuses),
        'services',v_services,'users',v_users,'peakHours',v_peak,'statusCodes',v_statuses,
        'comparison',jsonb_build_object('previousRequests',coalesce(v_prev_requests,0),'previousWeightedUsage',coalesce(v_prev_weighted,0)),
        'dataQuality',v_quality
      );

      update public.report_runs
      set status=case when v_partial then 'partial' else 'succeeded' end,
        report_data=v_data,executive_summary=v_summary,data_quality=v_quality,
        completed_at=now(),email_status=case when cardinality(recipient_ids)>0 then 'not_configured' else 'not_requested' end
      where id=v_run.id;

      insert into public.report_run_attempts(report_id,attempt_number,status,message)
      values(v_run.id,v_run.attempts+1,case when v_partial then 'partial' else 'succeeded' end,v_summary);

      foreach v_admin_id in array v_run.recipient_ids loop
        if exists(select 1 from public.profiles where id=v_admin_id and role in ('admin','owner')) then
          insert into public.user_notifications(user_id,title,body,type,metadata)
          values(v_admin_id,'اكتمل تقرير NOX APIS',left(v_run.template_name||' — '||v_summary,500),'info',
            jsonb_build_object('reportId',v_run.id,'status',case when v_partial then 'partial' else 'succeeded' end));
        end if;
      end loop;
    exception when others then
      v_error := left(sqlerrm,500);
      update public.report_runs
      set status=case when attempts>=max_attempts then 'failed' else 'queued' end,
        last_error=v_error,completed_at=case when attempts>=max_attempts then now() else null end
      where id=v_run.id;
      insert into public.report_run_attempts(report_id,attempt_number,status,message)
      values(v_run.id,v_run.attempts+1,'failed',v_error);
      if v_run.attempts+1>=v_run.max_attempts then
        foreach v_admin_id in array v_run.recipient_ids loop
          if exists(select 1 from public.profiles where id=v_admin_id and role in ('admin','owner')) then
            insert into public.user_notifications(user_id,title,body,type,metadata)
            values(v_admin_id,'فشل إنشاء تقرير NOX APIS',left(v_run.template_name||' — '||v_error,500),'warning',
              jsonb_build_object('reportId',v_run.id,'status','failed'));
          end if;
        end loop;
      end if;
    end;
  end loop;
  return v_processed;
end;
$$;

revoke all on function private.bmg_reports_process_queue() from public,anon,authenticated;
revoke all on function private.bmg_report_template_schedule() from public,anon,authenticated;
revoke all on function private.bmg_report_next_run(text,text,integer,integer,integer,integer,timestamptz) from public,anon,authenticated;

create or replace function private.bmg_reports_enqueue_due()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.report_templates%rowtype;
  v_count integer := 0;
begin
  for v_template in
    select * from public.report_templates
    where enabled and frequency<>'manual' and next_run_at<=now()
    order by next_run_at
    for update skip locked
    limit 20
  loop
    insert into public.report_runs(
      template_id,template_name,trigger_type,status,period_start,period_end,
      period_days,timezone,sections,filters,recipient_ids
    ) values (
      v_template.id,v_template.name,'scheduled','queued',
      now()-make_interval(days=>v_template.period_days),now(),
      v_template.period_days,v_template.timezone,v_template.sections,
      v_template.filters,v_template.recipient_ids
    );
    update public.report_templates
      set last_run_at=now(),
        next_run_at=private.bmg_report_next_run(
          v_template.frequency,v_template.timezone,v_template.schedule_hour,
          v_template.schedule_minute,v_template.schedule_weekday,
          v_template.schedule_monthday,now()
        )
      where id=v_template.id;
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.bmg_reports_enqueue_due() from public,anon,authenticated;

create or replace function private.bmg_reports_tick()
returns integer
language plpgsql
security definer
set search_path = ''
as $
declare v_enqueued integer; v_processed integer;
begin
  v_enqueued := private.bmg_reports_enqueue_due();
  v_processed := private.bmg_reports_process_queue();
  return v_enqueued + v_processed;
end;
$;
revoke all on function private.bmg_reports_tick() from public,anon,authenticated;

select cron.schedule(
  'nox-reports-scheduler',
  '* * * * *',
  'select private.bmg_reports_tick();'
);

commit;