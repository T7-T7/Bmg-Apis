-- Retire database features whose management pages were removed.
-- Preflight verified every target table is empty and no external FK references exist.
-- The webhook worker has already been replaced by an inert 410 endpoint.

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in ('nox-reports-scheduler', 'nox-webhook-delivery-worker')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

drop trigger if exists bmg_webhook_service_event on public.api_services;
drop trigger if exists bmg_webhook_incident_event on public.incidents;
drop trigger if exists bmg_webhook_maintenance_event on public.maintenance_windows;
drop trigger if exists report_template_schedule on public.report_templates;

-- Remove the worker's only Vault credential.
delete from vault.secrets
where name = 'nox_webhook_worker_token';

-- Remove RPCs and trigger functions for the retired reports feature.
drop function if exists public.bmg_admin_queue_report(uuid, integer);
drop function if exists private.bmg_reports_tick();
drop function if exists private.bmg_reports_process_queue();
drop function if exists private.bmg_reports_enqueue_due();
drop function if exists private.bmg_report_template_schedule();
drop function if exists private.bmg_report_next_run(text, text, integer, integer, integer, integer, timestamp with time zone);

-- Remove RPCs and trigger functions for the retired webhooks feature.
drop function if exists public.bmg_webhook_get_secret(text, uuid);
drop function if exists public.bmg_webhook_finish_delivery(text, uuid, integer, text, text);
drop function if exists public.bmg_webhook_claim_deliveries(text, integer);
drop function if exists public.bmg_admin_create_webhook(text, text, text[], text);
drop function if exists private.bmg_webhook_worker_token_valid(text);
drop function if exists private.bmg_webhook_service_event();
drop function if exists private.bmg_webhook_maintenance_event();
drop function if exists private.bmg_webhook_incident_event();
drop function if exists private.bmg_enqueue_webhook_event(text, jsonb);

-- Drop empty tables in dependency order.
drop table if exists public.report_run_attempts;
drop table if exists public.report_runs;
drop table if exists public.report_templates;

drop table if exists public.api_webhook_deliveries;
drop table if exists public.api_webhooks;

drop table if exists public.api_submissions;
drop table if exists private.api_health_checks;
