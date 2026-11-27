begin;
create or replace function private.bmg_cleanup_expired_platform_data()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_workspace record;
  v_service record;
  v_workspaces_deleted integer:=0;
  v_services_deleted integer:=0;
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
  v_cron_runs_deleted integer:=0;
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
  where started_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_incidents_deleted=row_count;

  delete from private.api_keys
  where revoked_at is not null
    and revoked_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_keys_deleted=row_count;

  delete from public.api_service_versions
  where created_at < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_versions_deleted=row_count;

  delete from cron.job_run_details
  where end_time < now()-interval '3 days 23 hours 50 minutes';
  get diagnostics v_cron_runs_deleted=row_count;

  for v_service in
    select s.id
    from public.api_services s
    where s.archived_at is not null
      and s.archived_at<=now()-interval '3 days 23 hours 50 minutes'
    for update skip locked
  loop
    delete from public.api_service_versions where service_id=v_service.id;
    delete from public.api_services where id=v_service.id;
    v_services_deleted:=v_services_deleted+1;
  end loop;

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
    'archived_services_deleted',v_services_deleted,
    'api_usage_deleted',v_api_usage_deleted,
    'hourly_usage_deleted',v_hourly_deleted,
    'demo_usage_deleted',v_demo_deleted,
    'audit_logs_deleted',v_audit_deleted,
    'notifications_deleted',v_notifications_deleted,
    'feedback_deleted',v_feedback_deleted,
    'invitations_deleted',v_invitations_deleted,
    'incident_updates_deleted',v_incident_updates_deleted,
    'incidents_deleted',v_incidents_deleted,
    'revoked_api_keys_deleted',v_keys_deleted,
    'service_versions_deleted',v_versions_deleted,
    'cron_run_history_deleted',v_cron_runs_deleted
  );
end;
$function$;
commit;