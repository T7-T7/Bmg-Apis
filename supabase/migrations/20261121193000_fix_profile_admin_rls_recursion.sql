begin;
create or replace function private.bmg_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id=(select auth.uid()) and role in ('admin','owner')
  );
$$;
revoke all on function private.bmg_is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.bmg_is_admin() to authenticated;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (id=(select auth.uid()) or (select private.bmg_is_admin()));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update to authenticated
using ((select private.bmg_is_admin()))
with check ((select private.bmg_is_admin()));
commit;