begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['user'::text, 'admin'::text, 'owner'::text]));

drop policy if exists api_services_admin_delete on public.api_services;
create policy api_services_admin_delete
  on public.api_services for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
  );

drop policy if exists api_services_admin_insert on public.api_services;
create policy api_services_admin_insert
  on public.api_services for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
  );

drop policy if exists api_services_admin_update on public.api_services;
create policy api_services_admin_update
  on public.api_services for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
  );

drop policy if exists api_services_read_active_or_admin on public.api_services;
create policy api_services_read_active_or_admin
  on public.api_services for select to anon, authenticated
  using (
    status <> 'disabled'
    or (
      (select auth.uid()) is not null
      and exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('admin', 'owner')
      )
    )
  );

drop policy if exists submissions_read_own_or_admin on public.api_submissions;
create policy submissions_read_own_or_admin
  on public.api_submissions for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
  );

drop policy if exists submissions_update_admin_or_own_pending on public.api_submissions;
create policy submissions_update_admin_or_own_pending
  on public.api_submissions for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
    or (
      user_id = (select auth.uid())
      and review_status = 'pending'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'owner')
    )
    or (
      user_id = (select auth.uid())
      and review_status = 'pending'
    )
  );

update public.profiles
set role = 'owner', updated_at = now()
where id = '8aa19698-e2a0-46c5-842e-3e0dcefe6583'
  and lower(email) = lower('fix.symbolic.99@gmail.com');

commit;
