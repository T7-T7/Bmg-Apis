create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  details text not null check (char_length(details) between 1 and 10000),
  page_path text not null default '/',
  rating smallint not null check (rating between 1 and 5),
  status text not null default 'received'
    check (status in ('received','reviewing','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_feedback_user_created_idx
  on public.user_feedback (user_id, created_at desc);

alter table public.user_feedback enable row level security;

grant select, insert, update on table public.user_feedback to authenticated;
revoke all on table public.user_feedback from anon;

drop policy if exists "Users can submit own feedback" on public.user_feedback;
create policy "Users can submit own feedback"
  on public.user_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own feedback" on public.user_feedback;
create policy "Users can read own feedback"
  on public.user_feedback for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users cannot update feedback" on public.user_feedback;
create policy "Admins can read all feedback"
  on public.user_feedback for select
  to authenticated
  using (private.bmg_is_admin());

drop policy if exists "Admins can update feedback status" on public.user_feedback;
create policy "Admins can update feedback status"
  on public.user_feedback for update
  to authenticated
  using (private.bmg_is_admin())
  with check (private.bmg_is_admin());

drop policy if exists "Users cannot delete feedback" on public.user_feedback;
create policy "Users cannot delete feedback"
  on public.user_feedback for delete
  to authenticated
  using (false);
