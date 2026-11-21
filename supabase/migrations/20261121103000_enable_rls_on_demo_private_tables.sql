begin;
alter table private.api_demo_usage enable row level security;
alter table private.api_demo_usage force row level security;
alter table private.api_demo_config enable row level security;
alter table private.api_demo_config force row level security;
commit;