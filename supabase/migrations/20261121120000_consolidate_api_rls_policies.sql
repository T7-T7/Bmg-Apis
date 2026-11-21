
drop policy if exists api_services_admin_manage on public.api_services;
drop policy if exists api_services_public_read_active on public.api_services;

create policy api_services_read_active_or_admin
on public.api_services
for select
to anon, authenticated
using (
  status <> 'disabled'
  or (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  )
);

create policy api_services_admin_insert
on public.api_services
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

create policy api_services_admin_update
on public.api_services
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

create policy api_services_admin_delete
on public.api_services
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

drop policy if exists submissions_admin_review on public.api_submissions;
drop policy if exists submissions_update_own_pending on public.api_submissions;

create policy submissions_update_admin_or_own_pending
on public.api_submissions
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
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
      and p.role = 'admin'
  )
  or (
    user_id = (select auth.uid())
    and review_status = 'pending'
  )
);
