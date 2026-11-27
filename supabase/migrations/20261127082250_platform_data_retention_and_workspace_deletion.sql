begin;

alter table public.organizations
  add column if not exists archived_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists purge_after timestamptz,
  add column if not exists deletion_was_archived boolean not null default false;

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
  v_archived_at timestamptz;
  v_deletion_requested_at timestamptz;
  v_name text;
  v_keys integer:=0;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select o.owner_id,o.is_default_workspace,o.archived_at,o.deletion_requested_at,o.name
  into v_owner,v_is_default,v_archived_at,v_deletion_requested_at,v_name
  from public.organizations o where o.id=p_organization_id for update;
  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if v_is_default then raise exception 'The default personal workspace cannot be deleted'; end if;
  if v_owner is distinct from v_actor then
    raise exception 'Only the workspace owner can delete it' using errcode='42501';
  end if;
  if v_deletion_requested_at is not null then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_owner::text,0));
  update private.api_keys
  set revoked_at=coalesce(revoked_at,now())
  where (organization_id=p_organization_id
    or project_id in (select p.id from public.projects p where p.organization_id=p_organization_id))
    and revoked_at is null;
  get diagnostics v_keys=row_count;

  update public.organization_invitations
  set revoked_at=coalesce(revoked_at,now())
  where organization_id=p_organization_id
    and accepted_at is null and declined_at is null and revoked_at is null;

  update public.organizations
  set deletion_was_archived=(archived_at is not null),
      archived_at=coalesce(archived_at,now()),
      deletion_requested_at=now(),
      purge_after=now()+interval '3 days 23 hours 50 minutes',
      updated_at=now()
  where id=p_organization_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'organization.deletion_requested','organization',p_organization_id::text,
    jsonb_build_object('name',v_name,'api_keys_revoked',v_keys,
      'purge_after',now()+interval '3 days 23 hours 50 minutes',
      'quota_redistributed_immediately',true));
  return true;
end;
$function$;

create or replace function public.bmg_cancel_organization_deletion(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_owner uuid;
  v_is_default boolean;
  v_requested_at timestamptz;
  v_purge_after timestamptz;
  v_was_archived boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select o.owner_id,o.is_default_workspace,o.deletion_requested_at,o.purge_after,o.deletion_was_archived
  into v_owner,v_is_default,v_requested_at,v_purge_after,v_was_archived
  from public.organizations o where o.id=p_organization_id for update;
  if not found then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if v_is_default then raise exception 'The default personal workspace cannot be restored'; end if;
  if v_owner is distinct from v_actor then
    raise exception 'Only the workspace owner can cancel deletion' using errcode='42501';
  end if;
  if v_requested_at is null then return false; end if;
  if v_purge_after is null or v_purge_after<=now() then
    raise exception 'Deletion window has expired' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_owner::text,0));
  update public.organizations
  set archived_at=case when v_was_archived then archived_at else null end,
      deletion_requested_at=null,purge_after=null,deletion_was_archived=false,updated_at=now()
  where id=p_organization_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_actor,'organization.deletion_canceled','organization',p_organization_id::text,
    jsonb_build_object('restored_to_active',not v_was_archived));
  return true;
end;
$function$;

create or replace function private.bmg_cleanup_expired_platform_data()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_workspace record;
  v_workspaces_deleted integer:=0;
  v_api_usage_deleted integer:=0;
  v_hourly_deleted integer:=0;
  v_demo_deleted integer:=0;
  v_audit_deleted integer:=0;
  v_notifications_deleted integer:=0;
  v_feedback_deleted integer:=0;
  v_invitations_deleted integer:=0;
  v_incident_updates_deleted integer:=0;
  v_incidents_deleted integer:=0;
  v_keys_deleted integer:=0;
  v_versions_deleted integer:=0;
begin
  delete from private.api_usage
  where created_at < now()-interval '23 hours 50 minutes' and aggregated_at is not null;
  get diagnostics v_api_usage_deleted=row_count;

  delete from private.api_demo_usage
  where created_at < now()-interval '23 hours 50 minutes';
  get diagnostics v_demo_deleted=row_count;

  delete from private.api_usage_hourly
  where bucket_hour < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_hourly_deleted=row_count;

  delete from public.audit_logs
  where created_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_audit_deleted=row_count;

  delete from public.user_notifications
  where created_at < now()-interval '1 day 23 hours 50 minutes';
  get diagnostics v_notifications_deleted=row_count;

  delete from public.user_feedback
  where created_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_feedback_deleted=row_count;

  delete from public.organization_invitations
  where created_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_invitations_deleted=row_count;

  delete from public.incident_updates
  where created_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_incident_updates_deleted=row_count;

  delete from public.incidents
  where resolved_at is not null
    and resolved_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_incidents_deleted=row_count;

  delete from private.api_keys
  where revoked_at is not null
    and revoked_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_keys_deleted=row_count;

  delete from public.api_service_versions
  where created_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_versions_deleted=row_count;

  for v_workspace in
    select o.id,o.owner_id
    from public.organizations o
    where o.is_default_workspace=false
      and (
        (o.deletion_requested_at is not null and o.purge_after<=now())
        or
        (o.deletion_requested_at is null and o.archived_at is not null
          and o.archived_at<=now()-interval '3 days 23 hours 50 minutes')
      )
    order by o.owner_id,o.id
    for update skip locked
  loop
    perform pg_advisory_xact_lock(hashtextextended('nox_scope_pool_owner:'||v_workspace.owner_id::text,0));
    delete from private.api_usage where organization_id=v_workspace.id;
    delete from private.api_usage_hourly where organization_id=v_workspace.id;
    delete from private.api_keys
    where organization_id=v_workspace.id
      or project_id in (select p.id from public.projects p where p.organization_id=v_workspace.id);
    delete from public.audit_logs
    where entity_type='organization' and entity_id=v_workspace.id::text;
    delete from public.organizations where id=v_workspace.id;
    v_workspaces_deleted:=v_workspaces_deleted+1;
  end loop;

  return jsonb_build_object(
    'workspaces_deleted',v_workspaces_deleted,
    'api_usage_deleted',v_api_usage_deleted,
    'hourly_usage_deleted',v_hourly_deleted,
    'demo_usage_deleted',v_demo_deleted,
    'audit_logs_deleted',v_audit_deleted,
    'notifications_deleted',v_notifications_deleted,
    'feedback_deleted',v_feedback_deleted,
    'invitations_deleted',v_invitations_deleted,
    'incident_updates_deleted',v_incident_updates_deleted,
    'resolved_incidents_deleted',v_incidents_deleted,
    'revoked_api_keys_deleted',v_keys_deleted,
    'service_versions_deleted',v_versions_deleted
  );
end;
$function$;

revoke all on function public.bmg_delete_organization(uuid) from public,anon;
grant execute on function public.bmg_delete_organization(uuid) to authenticated;
revoke all on function public.bmg_cancel_organization_deletion(uuid) from public,anon;
grant execute on function public.bmg_cancel_organization_deletion(uuid) to authenticated;
revoke all on function private.bmg_cleanup_expired_platform_data() from public,anon,authenticated;

select cron.schedule('nox-platform-retention-cleanup','*/5 * * * *',
  'select private.bmg_cleanup_expired_platform_data()');

commit;
