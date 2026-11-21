begin;

alter table public.profiles
  add column if not exists plan text not null default 'basic',
  add column if not exists plan_source text not null default 'default',
  add column if not exists plan_expires_at timestamptz,
  add column if not exists plan_grace_until timestamptz,
  add column if not exists account_status text not null default 'active',
  add column if not exists updated_by uuid references auth.users(id);

alter table public.profiles
  drop constraint if exists profiles_plan_check,
  add constraint profiles_plan_check check (plan in ('basic','pro','premium')),
  drop constraint if exists profiles_plan_source_check,
  add constraint profiles_plan_source_check check (plan_source in ('default','manual','subscription')),
  drop constraint if exists profiles_account_status_check,
  add constraint profiles_account_status_check check (account_status in ('active','suspended'));

alter table public.api_services
  add column if not exists archived_at timestamptz,
  add column if not exists current_version integer not null default 1;

create table if not exists public.api_plan_limits (
  plan text primary key check (plan in ('basic','pro','premium')),
  requests_per_minute integer not null check (requests_per_minute > 0),
  max_api_keys integer not null check (max_api_keys > 0),
  daily_weighted_limit bigint not null check (daily_weighted_limit > 0),
  monthly_weighted_limit bigint not null check (monthly_weighted_limit > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.api_plan_limits(plan,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit)
values
 ('basic',30,2,1000,20000),
 ('pro',60,10,10000,200000),
 ('premium',120,30,100000,2000000)
on conflict (plan) do nothing;

create table if not exists public.api_service_versions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.api_services(id) on delete restrict,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(service_id,version)
);

insert into public.api_service_versions(service_id,version,snapshot,change_note)
select s.id, 1,
       jsonb_build_object(
         'slug',s.slug,'name',s.name,'description',s.description,
         'category',s.category,'endpoint_path',s.endpoint_path,
         'http_method',s.http_method,'docs_markdown',s.docs_markdown,
         'status',s.status,'source_type',s.source_type,
         'healthcheck_config',s.healthcheck_config
       ),
       'Initial version'
from public.api_services s
where not exists (
  select 1 from public.api_service_versions v where v.service_id=s.id
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs(actor_id,created_at desc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  type text not null default 'info' check (type in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id,created_at desc);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  severity text not null default 'minor' check (severity in ('minor','major','critical')),
  status text not null default 'investigating' check (status in ('investigating','identified','monitoring','resolved')),
  affected_services text[] not null default '{}',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_status_started_idx on public.incidents(status,started_at desc);

create table if not exists public.maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.api_services(id) on delete cascade,
  enabled boolean not null default false,
  message text not null default 'الخدمة تحت الصيانة مؤقتاً.',
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists maintenance_windows_service_idx on public.maintenance_windows(service_id);

alter table public.api_plan_limits enable row level security;
alter table public.api_service_versions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.user_notifications enable row level security;
alter table public.incidents enable row level security;
alter table public.maintenance_windows enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (select 1 from public.profiles me where me.id=(select auth.uid()) and me.role in ('admin','owner'))
);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update to authenticated
using (exists (select 1 from public.profiles me where me.id=(select auth.uid()) and me.role in ('admin','owner')))
with check (exists (select 1 from public.profiles me where me.id=(select auth.uid()) and me.role in ('admin','owner')));

grant update (role,plan,plan_source,plan_expires_at,plan_grace_until,account_status,updated_by,updated_at)
on public.profiles to authenticated;

drop policy if exists api_services_read_active_or_admin on public.api_services;
create policy api_services_read_active_or_admin on public.api_services
for select to anon, authenticated
using (
  (status <> 'disabled' and archived_at is null)
  or (
    (select auth.uid()) is not null
    and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner'))
  )
);

create policy api_plan_limits_read_authenticated on public.api_plan_limits
for select to authenticated using (true);
create policy api_plan_limits_manage_admin on public.api_plan_limits
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));

create policy api_service_versions_read_admin on public.api_service_versions
for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));
create policy api_service_versions_insert_admin on public.api_service_versions
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));

create policy audit_logs_read_admin on public.audit_logs
for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));
create policy audit_logs_insert_admin on public.audit_logs
for insert to authenticated
with check (actor_id=(select auth.uid()) and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));

create policy notifications_read_own_or_admin on public.user_notifications
for select to authenticated
using (user_id=(select auth.uid()) or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));
create policy notifications_insert_admin on public.user_notifications
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));
create policy notifications_update_own_read on public.user_notifications
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
grant update (read_at) on public.user_notifications to authenticated;

create policy incidents_public_read on public.incidents
for select to anon, authenticated using (true);
create policy incidents_manage_admin on public.incidents
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));

create policy maintenance_public_read_enabled on public.maintenance_windows
for select to anon, authenticated using (enabled=true);
create policy maintenance_manage_admin on public.maintenance_windows
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','owner')));

grant select on public.api_plan_limits to authenticated;
grant insert,select on public.api_service_versions to authenticated;
grant select,insert on public.audit_logs to authenticated;
grant select,insert,update(read_at) on public.user_notifications to authenticated;
grant select,insert,update,delete on public.incidents to authenticated;
grant select,insert,update,delete on public.maintenance_windows to authenticated;

commit;