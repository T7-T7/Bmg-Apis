begin;
create or replace function public.bmg_delete_organization(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_owner uuid;
  v_is_default boolean;
  v_name text;
  v_projects integer:=0;
  v_keys integer:=0;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select o.owner_id,o.is_default_workspace,o.name
  into v_owner,v_is_default,v_name
  from public.organizations o
  where o.id=p_organization_id
  for update;

  if not found then
    raise exception 'Workspace not found' using errcode='P0002';
  end if;
  if v_is_default then
    raise exception 'The default personal workspace cannot be deleted';
  end if;
  if v_owner is distinct from v_actor then
    raise exception 'Only the workspace owner can delete it' using errcode='42501';
  end if;

  -- Serialize deletion with API authorization and quota redistribution for this owner.
  perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_owner::text,0));

  select count(*)::integer into v_projects
  from public.projects p where p.organization_id=p_organization_id;

  update private.api_keys
  set revoked_at=coalesce(revoked_at,now())
  where organization_id=p_organization_id and revoked_at is null;
  get diagnostics v_keys=row_count;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    v_actor,
    'organization.delete',
    'organization',
    p_organization_id::text,
    jsonb_build_object(
      'name',v_name,
      'projects_deleted',v_projects,
      'api_keys_revoked',v_keys,
      'usage_history_retained',true
    )
  );

  -- Usage rows and hourly rollups intentionally have no cascading FK to organizations,
  -- so historical metering remains available for platform audit after the workspace is removed.
  delete from public.organizations where id=p_organization_id;
  return true;
end;
$function$;

revoke all on function public.bmg_delete_organization(uuid) from public,anon;
grant execute on function public.bmg_delete_organization(uuid) to authenticated;
commit;