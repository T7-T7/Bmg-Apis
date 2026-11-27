begin;
revoke all on table public.api_scope_default_limits from public, anon;
grant select on table public.api_scope_default_limits to authenticated;
create index if not exists api_scope_default_limits_updated_by_idx
  on public.api_scope_default_limits(updated_by) where updated_by is not null;
commit;