begin;
do $fix$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_admin_get_scope_pool_limits()'::regprocedure);
  v_definition:=replace(v_definition,
    'v_role not in (''admin'',''owner'')',
    'coalesce(v_role,'''') not in (''admin'',''owner'')');
  execute v_definition;

  v_definition:=pg_get_functiondef('public.bmg_admin_set_scope_pool_limits(integer,bigint,bigint)'::regprocedure);
  v_definition:=replace(v_definition,
    'v_role not in (''admin'',''owner'')',
    'coalesce(v_role,'''') not in (''admin'',''owner'')');
  execute v_definition;

  v_definition:=pg_get_functiondef('public.bmg_create_project(uuid,text,text)'::regprocedure);
  v_definition:=replace(v_definition,
    'if not private.bmg_can_manage_org(p_organization_id)',
    'if not coalesce(private.bmg_can_manage_org(p_organization_id),false)');
  execute v_definition;
end;
$fix$;
commit;