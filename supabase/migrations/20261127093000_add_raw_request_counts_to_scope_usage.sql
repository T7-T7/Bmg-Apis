begin;
create index if not exists api_scope_pool_limits_updated_by_idx
  on private.api_scope_pool_limits(updated_by) where updated_by is not null;
create index if not exists api_keys_organization_id_idx
  on private.api_keys(organization_id);
create index if not exists api_keys_project_id_idx
  on private.api_keys(project_id);
create index if not exists api_usage_organization_created_idx
  on private.api_usage(organization_id,created_at desc);
create index if not exists api_usage_project_created_idx
  on private.api_usage(project_id,created_at desc);

do $upgrade$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_get_organization_usage(uuid,integer)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_daily_usage bigint:=0;',
    '  v_daily_usage bigint:=0;'||chr(10)||'  v_daily_requests bigint:=0;');
  v_definition:=replace(v_definition,
    '  v_monthly_usage bigint:=0;',
    '  v_monthly_usage bigint:=0;'||chr(10)||'  v_monthly_requests bigint:=0;');
  v_definition:=replace(v_definition,
    '  select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (',
    '  select coalesce(sum(x.request_count),0)::bigint into v_daily_requests from ('||chr(10)||
    '    select h.request_count from private.api_usage_hourly h where h.organization_id=p_organization_id and h.bucket_hour>=date_trunc(''day'',now())'||chr(10)||
    '    union all select 1::bigint from private.api_usage u where u.organization_id=p_organization_id and u.created_at>=date_trunc(''day'',now()) and u.aggregated_at is null'||chr(10)||
    '  ) x;'||chr(10)||chr(10)||
    '  select coalesce(sum(x.request_count),0)::bigint into v_monthly_requests from ('||chr(10)||
    '    select h.request_count from private.api_usage_hourly h where h.organization_id=p_organization_id and h.bucket_hour>=date_trunc(''month'',now())'||chr(10)||
    '    union all select 1::bigint from private.api_usage u where u.organization_id=p_organization_id and u.created_at>=date_trunc(''month'',now()) and u.aggregated_at is null'||chr(10)||
    '  ) x;'||chr(10)||chr(10)||
    '  select coalesce(sum(x.weighted_usage),0)::bigint into v_monthly_usage from (');
  v_definition:=replace(v_definition,
    '''requestsPerMinute'',v_rpm_usage,',
    '''requestsPerMinute'',v_rpm_usage,''dailyRequests'',v_daily_requests,''monthlyRequests'',v_monthly_requests,');
  execute v_definition;
end;
$upgrade$;
commit;