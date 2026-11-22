-- NOX APIS webhook delivery control plane
create extension if not exists pg_net;

create table if not exists public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  target_url text not null check (
    target_url ~ '^https://'
    and target_url !~* '^https://(localhost|127\\.|0\\.|10\\.|192\\.168\\.|169\\.254\\.|\\[::1\\]|\\[fc|\\[fd|\\[fe80)'
  ),
  event_types text[] not null check (cardinality(event_types) > 0),
  enabled boolean not null default true,
  secret_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_delivery_at timestamptz,
  last_success_at timestamptz
);

create table if not exists public.api_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.api_webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 12),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  response_status integer,
  response_excerpt text,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_webhooks_enabled_idx on public.api_webhooks(enabled);
create index if not exists api_webhook_deliveries_due_idx
  on public.api_webhook_deliveries(status,next_attempt_at,created_at)
  where status in ('pending','processing');
create index if not exists api_webhook_deliveries_webhook_created_idx
  on public.api_webhook_deliveries(webhook_id,created_at desc);

alter table public.api_webhooks enable row level security;
alter table public.api_webhook_deliveries enable row level security;

drop policy if exists "admins manage webhooks" on public.api_webhooks;
create policy "admins manage webhooks" on public.api_webhooks
  for all to authenticated
  using ((select private.bmg_is_admin()))
  with check ((select private.bmg_is_admin()));

drop policy if exists "admins read webhook deliveries" on public.api_webhook_deliveries;
create policy "admins read webhook deliveries" on public.api_webhook_deliveries
  for select to authenticated
  using ((select private.bmg_is_admin()));

grant select, update, delete on public.api_webhooks to authenticated;
grant select on public.api_webhook_deliveries to authenticated;
revoke insert, update, delete on public.api_webhook_deliveries from anon, authenticated;

create or replace function public.bmg_admin_create_webhook(
  p_name text,
  p_target_url text,
  p_event_types text[],
  p_secret text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_secret_id uuid;
  v_allowed text[] := array[
    'incident.created','incident.updated','incident.resolved',
    'service.created','service.updated','service.archived',
    'maintenance.changed'
  ];
begin
  if auth.uid() is null or not private.bmg_is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 2 and 80 then
    raise exception 'Webhook name must be between 2 and 80 characters';
  end if;
  if p_target_url !~ '^https://' or p_target_url ~* '^https://(localhost|127\\.|0\\.|10\\.|192\\.168\\.|169\\.254\\.|\\[::1\\]|\\[fc|\\[fd|\\[fe80)' then
    raise exception 'A public HTTPS endpoint is required';
  end if;
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 256 then
    raise exception 'Webhook secret must contain 32 to 256 characters';
  end if;
  if coalesce(cardinality(p_event_types),0) = 0
     or exists(select 1 from unnest(p_event_types) e where not (e = any(v_allowed))) then
    raise exception 'Unsupported webhook event';
  end if;
  v_secret_id := vault.create_secret(p_secret, 'nox_webhook_' || v_id::text, 'NOX APIS webhook signing secret');
  insert into public.api_webhooks(id,name,target_url,event_types,secret_id,created_by)
  values(v_id,btrim(p_name),p_target_url,p_event_types,v_secret_id,auth.uid());
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'webhook.create','api_webhook',v_id::text,jsonb_build_object('name',btrim(p_name),'events',p_event_types));
  return v_id;
end;
$$;

revoke all on function public.bmg_admin_create_webhook(text,text,text[],text) from public, anon;
grant execute on function public.bmg_admin_create_webhook(text,text,text[],text) to authenticated;

create or replace function private.bmg_enqueue_webhook_event(p_event_type text,p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.api_webhook_deliveries(webhook_id,event_type,payload)
  select w.id,p_event_type,
    jsonb_build_object(
      'id',gen_random_uuid(),
      'type',p_event_type,
      'created_at',now(),
      'data',coalesce(p_data,'{}'::jsonb)
    )
  from public.api_webhooks w
  where w.enabled and p_event_type = any(w.event_types);
end;
$$;

create or replace function private.bmg_webhook_incident_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event text;
begin
  if tg_op = 'INSERT' then
    v_event := 'incident.created';
  elsif new.status = 'resolved' and old.status is distinct from 'resolved' then
    v_event := 'incident.resolved';
  else
    v_event := 'incident.updated';
  end if;
  perform private.bmg_enqueue_webhook_event(v_event,jsonb_build_object(
    'incident_id',new.id,'title',new.title,'description',new.description,
    'severity',new.severity,'status',new.status,'affected_services',new.affected_services,
    'started_at',new.started_at,'resolved_at',new.resolved_at
  ));
  return new;
end;
$$;

create or replace function private.bmg_webhook_service_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_event text;
begin
  if tg_op = 'INSERT' then
    v_event := 'service.created';
  elsif new.archived_at is not null and old.archived_at is null then
    v_event := 'service.archived';
  else
    v_event := 'service.updated';
  end if;
  perform private.bmg_enqueue_webhook_event(v_event,jsonb_build_object(
    'service_id',new.id,'slug',new.slug,'name',new.name,'category',new.category,
    'status',new.status,'http_method',new.http_method,'endpoint_path',new.endpoint_path,
    'version',new.current_version,'archived_at',new.archived_at
  ));
  return new;
end;
$$;

create or replace function private.bmg_webhook_maintenance_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.bmg_enqueue_webhook_event('maintenance.changed',jsonb_build_object(
    'maintenance_id',new.id,'service_id',new.service_id,'enabled',new.enabled,
    'message',new.message,'starts_at',new.starts_at,'ends_at',new.ends_at
  ));
  return new;
end;
$$;

drop trigger if exists bmg_webhook_incident_event on public.incidents;
create trigger bmg_webhook_incident_event
after insert or update on public.incidents
for each row execute function private.bmg_webhook_incident_event();

drop trigger if exists bmg_webhook_service_event on public.api_services;
create trigger bmg_webhook_service_event
after insert or update on public.api_services
for each row execute function private.bmg_webhook_service_event();

drop trigger if exists bmg_webhook_maintenance_event on public.maintenance_windows;
create trigger bmg_webhook_maintenance_event
after insert or update on public.maintenance_windows
for each row execute function private.bmg_webhook_maintenance_event();

create or replace function private.bmg_webhook_worker_token_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_token is not null and exists(
    select 1 from vault.decrypted_secrets
    where name = 'nox_webhook_worker_token' and decrypted_secret = p_token
  );
$$;

create or replace function public.bmg_webhook_claim_deliveries(p_token text,p_limit integer default 20)
returns table(delivery_id uuid,webhook_id uuid,target_url text,event_type text,payload jsonb,attempt integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role'
     or not private.bmg_webhook_worker_token_valid(p_token) then
    raise exception 'unauthorized worker' using errcode = '42501';
  end if;
  return query
  with picked as (
    select d.id
    from public.api_webhook_deliveries d
    join public.api_webhooks w on w.id=d.webhook_id and w.enabled
    where (d.status='pending' and d.next_attempt_at <= now())
       or (d.status='processing' and d.last_attempt_at < now()-interval '10 minutes')
    order by d.next_attempt_at,d.created_at
    for update of d skip locked
    limit greatest(1,least(coalesce(p_limit,20),50))
  ),
  claimed as (
    update public.api_webhook_deliveries d
    set status='processing',attempts=d.attempts+1,last_attempt_at=now()
    from picked p
    where d.id=p.id
    returning d.id,d.webhook_id,d.event_type,d.payload,d.attempts
  )
  select c.id,c.webhook_id,w.target_url,c.event_type,c.payload,c.attempts
  from claimed c join public.api_webhooks w on w.id=c.webhook_id;
end;
$$;

create or replace function public.bmg_webhook_get_secret(p_token text,p_webhook_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role'
     or not private.bmg_webhook_worker_token_valid(p_token) then
    raise exception 'unauthorized worker' using errcode = '42501';
  end if;
  select s.decrypted_secret into v_secret
  from public.api_webhooks w
  join vault.decrypted_secrets s on s.id=w.secret_id
  where w.id=p_webhook_id and w.enabled;
  return v_secret;
end;
$$;

create or replace function public.bmg_webhook_finish_delivery(
  p_token text,p_delivery_id uuid,p_status_code integer,p_response_excerpt text,p_error text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_attempts integer; v_max integer; v_webhook uuid; v_ok boolean;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role'
     or not private.bmg_webhook_worker_token_valid(p_token) then
    raise exception 'unauthorized worker' using errcode = '42501';
  end if;
  v_ok := p_status_code between 200 and 299;
  update public.api_webhook_deliveries d
  set response_status=p_status_code,
      response_excerpt=left(coalesce(p_response_excerpt,''),500),
      last_error=left(coalesce(p_error,''),500),
      status=case when v_ok then 'succeeded' when d.attempts >= d.max_attempts then 'failed' else 'pending' end,
      delivered_at=case when v_ok then now() else null end,
      next_attempt_at=case when v_ok or d.attempts >= d.max_attempts then d.next_attempt_at
        else now() + make_interval(secs => least(21600,30 * (2 ^ greatest(0,d.attempts-1))::integer)) end
  where d.id=p_delivery_id and d.status='processing'
  returning d.attempts,d.max_attempts,d.webhook_id into v_attempts,v_max,v_webhook;
  if v_webhook is null then return; end if;
  update public.api_webhooks
  set last_delivery_at=now(),last_success_at=case when v_ok then now() else last_success_at end
  where id=v_webhook;
end;
$$;

revoke all on function public.bmg_webhook_claim_deliveries(text,integer) from public,anon,authenticated;
revoke all on function public.bmg_webhook_get_secret(text,uuid) from public,anon,authenticated;
revoke all on function public.bmg_webhook_finish_delivery(text,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.bmg_webhook_claim_deliveries(text,integer) to service_role;
grant execute on function public.bmg_webhook_get_secret(text,uuid) to service_role;
grant execute on function public.bmg_webhook_finish_delivery(text,uuid,integer,text,text) to service_role;

do $$
declare v_token text;
begin
  if not exists(select 1 from vault.decrypted_secrets where name='nox_webhook_worker_token') then
    v_token := encode(gen_random_bytes(32),'hex');
    perform vault.create_secret(v_token,'nox_webhook_worker_token','Internal authentication token for NOX webhook worker');
  end if;
end;
$$;

select cron.schedule(
  'nox-webhook-delivery-worker',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://qjcosavomxrgnccadpio.supabase.co/functions/v1/nox-webhook-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='nox_webhook_worker_token')
    ),
    body := jsonb_build_object('source','pg_cron'),
    timeout_milliseconds := 10000
  );
  $job$
);
