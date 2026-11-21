create table if not exists public.api_service_dependencies (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.api_services(id) on delete cascade,
  depends_on_service_id uuid not null references public.api_services(id) on delete cascade,
  dependency_type text not null default 'required' check (dependency_type in ('required','optional')),
  description text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint api_service_dependencies_not_self check (service_id<>depends_on_service_id),
  constraint api_service_dependencies_unique unique(service_id,depends_on_service_id)
);

create index if not exists api_service_dependencies_service_idx on public.api_service_dependencies(service_id);
create index if not exists api_service_dependencies_target_idx on public.api_service_dependencies(depends_on_service_id);

alter table public.api_service_dependencies enable row level security;
drop policy if exists api_service_dependencies_admin_manage on public.api_service_dependencies;
create policy api_service_dependencies_admin_manage on public.api_service_dependencies
for all to authenticated using (private.bmg_is_admin()) with check (private.bmg_is_admin());
grant select,insert,update,delete on public.api_service_dependencies to authenticated;

create or replace function public.bmg_prevent_service_dependency_cycle()
returns trigger language plpgsql set search_path = ''
as $$
declare v_cycle boolean;
begin
  if new.service_id=new.depends_on_service_id then
    raise exception 'A service cannot depend on itself' using errcode='22023';
  end if;
  with recursive dependency_path(service_id) as (
    select new.depends_on_service_id
    union
    select d.depends_on_service_id
    from public.api_service_dependencies d
    join dependency_path p on d.service_id=p.service_id
    where d.id is distinct from new.id
  )
  select exists(select 1 from dependency_path where service_id=new.service_id) into v_cycle;
  if v_cycle then raise exception 'Service dependency would create a cycle' using errcode='23514'; end if;
  return new;
end;
$$;

drop trigger if exists api_service_dependencies_prevent_cycle on public.api_service_dependencies;
create trigger api_service_dependencies_prevent_cycle
before insert or update of service_id,depends_on_service_id
on public.api_service_dependencies
for each row execute function public.bmg_prevent_service_dependency_cycle();
