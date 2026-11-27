begin;
do $fix$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_authorize_api_request(text,text,text,text)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_pool_scope_count bigint;',
    '  v_pool_scope_owner uuid;'||chr(10)||'  v_pool_scope_count bigint;');
  v_definition:=replace(v_definition,
    'select * into v_pool_scope_count,v_pool_scope_position,v_pool_rpm,v_pool_daily,v_pool_monthly',
    'select * into v_pool_scope_owner,v_pool_scope_count,v_pool_scope_position,v_pool_rpm,v_pool_daily,v_pool_monthly');
  execute v_definition;
end;
$fix$;
commit;