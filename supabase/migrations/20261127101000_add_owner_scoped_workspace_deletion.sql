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

  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if v_is_default then raise exception 'The default personal workspace cannot be deleted'; end if;
  if v_owner is distinct from v_actor then
    raise exception 'Only the workspace owner can delete it' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_owner::text,0));

  select count(*)::integer into v_projects
  from public.projects p where p.organization_id=p_organization_id;

  select count(*)::integer into v_keys
  from private.api_keys k where k.organization_id=p_organization_id;

  -- Keep revoked key records for audit linkage, but detach them from the rows being deleted.
  update private.api_keys
  set revoked_at=coalesce(revoked_at,now()),
      organization_id=null,
      project_id=null,
      scopes=array_remove(scopes,'api:use')
  where organization_id=p_organization_id;

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

  delete from public.organizations where id=p_organization_id;
  return true;
end;
$function$;
commit;