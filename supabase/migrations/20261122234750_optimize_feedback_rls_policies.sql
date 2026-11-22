drop policy if exists "Users can submit own feedback" on public.user_feedback;
create policy "Users can submit own feedback"
  on public.user_feedback for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own feedback" on public.user_feedback;
drop policy if exists "Admins can read all feedback" on public.user_feedback;
create policy "Users and admins can read feedback"
  on public.user_feedback for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select private.bmg_is_admin())
  );

drop policy if exists "Admins can update feedback status" on public.user_feedback;
create policy "Admins can update feedback status"
  on public.user_feedback for update
  to authenticated
  using ((select private.bmg_is_admin()))
  with check ((select private.bmg_is_admin()));
