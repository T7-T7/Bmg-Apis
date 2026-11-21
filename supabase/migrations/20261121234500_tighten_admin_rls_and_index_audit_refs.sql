begin;

drop policy if exists profiles_update_admin on public.profiles;
revoke update (role,plan,plan_source,plan_expires_at,plan_grace_until,account_status,updated_by,updated_at)
on public.profiles from authenticated;

drop policy if exists api_plan_limits_manage_admin on public.api_plan_limits;
create policy api_plan_limits_insert_admin on public.api_plan_limits
for insert to authenticated with check (private.bmg_is_admin());
create policy api_plan_limits_update_admin on public.api_plan_limits
for update to authenticated using (private.bmg_is_admin()) with check (private.bmg_is_admin());
create policy api_plan_limits_delete_admin on public.api_plan_limits
for delete to authenticated using (private.bmg_is_admin());
grant insert,update,delete on public.api_plan_limits to authenticated;

create index if not exists api_admin_limits_updated_by_idx on public.api_admin_limits(updated_by) where updated_by is not null;
create index if not exists api_plan_limits_updated_by_idx on public.api_plan_limits(updated_by) where updated_by is not null;
create index if not exists api_service_versions_created_by_idx on public.api_service_versions(created_by) where created_by is not null;
create index if not exists incidents_created_by_idx on public.incidents(created_by) where created_by is not null;
create index if not exists maintenance_windows_updated_by_idx on public.maintenance_windows(updated_by) where updated_by is not null;
create index if not exists profiles_updated_by_idx on public.profiles(updated_by) where updated_by is not null;

commit;