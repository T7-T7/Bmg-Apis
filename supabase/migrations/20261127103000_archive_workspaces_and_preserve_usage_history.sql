begin;
alter table public.organizations
  add column if not exists archived_at timestamptz;

do $migration$
declare
  v_definition text;
begin
  -- Archived workspaces no longer participate in the owner's shared pool.
  v_definition:=pg_get_functiondef('private.bmg_get_scope_pool_allocation(uuid)'::regprocedure);
  v_definition:=replace(v_definition,
    'where o.id=p_organization_id and o.is_default_workspace=false',
    'where o.id=p_organization_id and o.is_default_workspace=false and o.archived_at is null');
  v_definition:=replace(v_definition,
    'where o.is_default_workspace=false',
    'where o.is_default_workspace=false and o.archived_at is null');
  if position('o.archived_at is null' in v_definition)=0 then
    raise exception 'Could not apply archived workspace filter to pool allocation';
  end if;
  execute v_definition;

  -- API authorization rejects archived workspaces even if an old key remains.
  v_definition:=pg_get_functiondef('public.bmg_authorize_api_request(text,text,text,text)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_is_default boolean:=false;',
    '  v_is_default boolean:=false;'||chr(10)||'  v_scope_archived boolean:=false;');
  v_definition:=replace(v_definition,
    'select o.is_default_workspace,o.owner_id into v_is_default,v_scope_owner_id',
    'select o.is_default_workspace,o.owner_id,(o.archived_at is not null) into v_is_default,v_scope_owner_id,v_scope_archived');
  v_definition:=replace(v_definition,
    'if not found then return jsonb_build_object(''authorized'',false,''reason'',''invalid_project''); end if;'||chr(10)||'  v_usage_weight:=',
    'if not found then return jsonb_build_object(''authorized'',false,''reason'',''invalid_project''); end if;'||chr(10)||
    '  if v_scope_archived then return jsonb_build_object(''authorized'',false,''reason'',''workspace_archived''); end if;'||chr(10)||
    '  v_usage_weight:=');
  if position('workspace_archived' in v_definition)=0 then
    raise exception 'Could not add archived workspace authorization guard';
  end if;
  execute v_definition;

  -- Prevent creating projects or invitations in archived workspaces through direct RPC calls.
  v_definition:=pg_get_functiondef('public.bmg_create_project(uuid,text,text)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_is_default boolean;',
    '  v_is_default boolean;'||chr(10)||'  v_is_archived boolean;');
  v_definition:=replace(v_definition,
    'select o.is_default_workspace into v_is_default',
    'select o.is_default_workspace,(o.archived_at is not null) into v_is_default,v_is_archived');
  v_definition:=replace(v_definition,
    'if not found then raise exception ''Organization not found''; end if;',
    'if not found then raise exception ''Organization not found''; end if;'||chr(10)||
    '  if v_is_archived then raise exception ''Workspace is archived'' using errcode=''42501''; end if;');
  execute v_definition;

  v_definition:=pg_get_functiondef('public.bmg_invite_organization_member(uuid,text,text,uuid)'::regprocedure);
  v_definition:=replace(v_definition,
    '  v_org_name text;',
    '  v_org_name text;'||chr(10)||'  v_is_archived boolean;');
  v_definition:=replace(v_definition,
    '  if not private.bmg_can_manage_org(p_organization_id) then raise exception ''Organization invitation permission required'' using errcode=''42501''; end if;',
    '  select (o.archived_at is not null) into v_is_archived from public.organizations o where o.id=p_organization_id;'||chr(10)||
    '  if not found then raise exception ''Organization not found''; end if;'||chr(10)||
    '  if v_is_archived then raise exception ''Workspace is archived'' using errcode=''42501''; end if;'||chr(10)||
    '  if not private.bmg_can_manage_org(p_organization_id) then raise exception ''Organization invitation permission required'' using errcode=''42501''; end if;');
  execute v_definition;
end;
$migration$;

create or replace function public.bmg_archive_organization(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_owner uuid;
  v_is_default boolean;
  v_archived_at timestamptz;
  v_name text;
  v_projects integer:=0;
  v_keys integer:=0;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;

  select o.owner_id,o.is_default_workspace,o.archived_at,o.name
  into v_owner,v_is_default,v_archived_at,v_name
  from public.organizations o
  where o.id=p_organization_id
  for update;

  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if v_is_default then raise exception 'The default personal workspace cannot be archived'; end if;
  if v_owner is distinct from v_actor then
    raise exception 'Only the workspace owner can archive it' using errcode='42501';
  end if;
  if v_archived_at is not null then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_owner::text,0));

  select count(*)::integer into v_projects
  from public.projects p where p.organization_id=p_organization_id;

  update private.api_keys
  set revoked_at=coalesce(revoked_at,now())
  where organization_id=p_organization_id and revoked_at is null;
  get diagnostics v_keys=row_count;

  update public.organizations
  set archived_at=now(),updated_at=now()
  where id=p_organization_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    v_actor,
    'organization.archive',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'name',v_name,
      'projects_retained',v_projects,
      'api_keys_revoked',v_keys,
      'usage_history_retained',true,
      'quota_redistributed_immediately',true
    )
  );
  return true;
end;
$function$;

-- bmg_delete_organization remains the delayed physical-deletion RPC.
revoke all on function public.bmg_archive_organization(uuid) from public,anon;
revoke all on function public.bmg_delete_organization(uuid) from public,anon;
grant execute on function public.bmg_archive_organization(uuid) to authenticated;
grant execute on function public.bmg_delete_organization(uuid) to authenticated;
commit;