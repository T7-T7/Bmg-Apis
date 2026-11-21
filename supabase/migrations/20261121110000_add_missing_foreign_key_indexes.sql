-- Index foreign-key columns used in joins and cascades.
-- These indexes are additive and do not change row-level authorization.
create index if not exists api_usage_api_key_id_idx
  on private.api_usage(api_key_id);

create index if not exists api_services_owner_id_idx
  on public.api_services(owner_id);

create index if not exists api_submissions_reviewer_id_idx
  on public.api_submissions(reviewer_id);
