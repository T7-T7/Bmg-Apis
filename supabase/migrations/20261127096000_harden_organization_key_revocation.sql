begin;
do $fix$
declare
  v_definition text;
begin
  v_definition:=pg_get_functiondef('public.bmg_revoke_organization_api_key(uuid)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_is_default boolean;',
    '  v_is_default boolean;'||chr(10)||'  v_workspace_owner uuid;');
  v_definition:=replace(v_definition,
    '  select k.user_id,k.organization_id,o.is_default_workspace',
    '  select k.user_id,k.organization_id,o.is_default_workspace,o.owner_id');
  v_definition:=replace(v_definition,
    'into v_key_owner,v_organization_id,v_is_default',
    'into v_key_owner,v_organization_id,v_is_default,v_workspace_owner');
  v_definition:=replace(v_definition,
    'if v_key_owner<>v_actor and v_member_role not in (''owner'',''admin'') then',
    'if v_key_owner is distinct from v_actor and v_workspace_owner is distinct from v_actor and coalesce(v_member_role,'''') not in (''owner'',''admin'') then');
  execute v_definition;
end;
$fix$;
commit;