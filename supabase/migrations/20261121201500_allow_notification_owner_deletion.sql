begin;
drop policy if exists notifications_delete_own on public.user_notifications;
create policy notifications_delete_own on public.user_notifications
for delete to authenticated using (user_id=(select auth.uid()));
grant delete on public.user_notifications to authenticated;
commit;