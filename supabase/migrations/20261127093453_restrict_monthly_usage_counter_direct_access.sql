begin;
revoke all on table private.api_usage_monthly_counters from service_role;
revoke all on sequence private.api_usage_monthly_counters_id_seq from public,anon,authenticated,service_role;
commit;