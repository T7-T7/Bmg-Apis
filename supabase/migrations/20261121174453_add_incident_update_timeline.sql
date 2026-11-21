create table if not exists public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  status text check (status is null or status in ('investigating','identified','monitoring','resolved')),
  message text not null check (length(trim(message))>0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists incident_updates_incident_created_idx on public.incident_updates(incident_id,created_at desc);
alter table public.incident_updates enable row level security;
drop policy if exists incident_updates_public_read on public.incident_updates;
create policy incident_updates_public_read on public.incident_updates
for select to anon,authenticated using (true);
drop policy if exists incident_updates_admin_insert on public.incident_updates;
create policy incident_updates_admin_insert on public.incident_updates
for insert to authenticated with check (private.bmg_is_admin() and created_by=(select auth.uid()));
grant select on public.incident_updates to anon,authenticated;
grant insert on public.incident_updates to authenticated;
