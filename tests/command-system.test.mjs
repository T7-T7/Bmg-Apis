import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("registry marks only wired handlers active", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  for (const command of ["profile.update","profile.grant_admin","api_key.update","api_key.delete","service.create","service.rollback"]) {
    assert.ok(registry.includes('"'+command+'"'), command);
  }
  assert.ok(registry.includes('state: "active"'));
  assert.ok(registry.includes('state: "planned"'));
  assert.ok(registry.includes("Object.freeze"));
  assert.ok(!registry.includes("eval("));
  assert.ok(!registry.includes("new Function("));
});

test("executor authenticates before dispatch and blocks planned commands", () => {
  const executor = read("../lib/core/commands/command-executor.ts");
  const authIndex = executor.indexOf("dependencies.authorize(input.request)");
  const stateIndex = executor.indexOf('definition.state !== "active"');
  const handlerIndex = executor.indexOf("await handler(input.input");
  assert.ok(authIndex >= 0 && stateIndex > authIndex && handlerIndex > stateIndex);
  assert.ok(executor.includes('actor.role !== "admin" && actor.role !== "owner"'));
  assert.ok(executor.includes('definition.permission === "owner"'));
});

test("runtime verifies Supabase user and role server-side and uses existing protected RPCs", () => {
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  assert.ok(runtime.includes("supabase.auth.getUser()"));
  assert.ok(runtime.includes('.select("role")'));
  for (const rpc of ["bmg_admin_update_profile","bmg_admin_update_api_key","bmg_admin_delete_api_key"]) assert.ok(runtime.includes(rpc));
  assert.ok(!runtime.includes("service_role"));
});

test("admin route enforces same-origin requests and bounded JSON input", () => {
  const route = read("../app/api/admin/commands/route.ts");
  assert.ok(route.includes('request.headers.get("origin")'));
  assert.ok(route.includes("MAX_BODY_BYTES"));
  assert.ok(route.includes("executeAdminCommand"));
  assert.ok(route.includes('"Cache-Control": "no-store"'));
});


test("service version reads and rollback are active only through protected command handlers", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"service.versions.list": active("admin", "listServiceVersions")'));
  assert.ok(registry.includes('"service.rollback": active("admin", "rollbackServiceVersion")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_get_service_versions"'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_rollback_api_service"'));
  assert.ok(runtime.includes("Number.isSafeInteger(input.version)"));
  assert.ok(ui.includes('runAdminCommand<ServiceVersion[]>("service.versions.list"'));
  assert.ok(ui.includes('runAdminCommand<{version:number}>("service.rollback"'));
  assert.ok(!ui.includes('supabase.rpc("bmg_admin_rollback_api_service"'));
  assert.ok(!ui.includes('supabase.rpc("bmg_admin_get_service_versions"'));
});


test("service archive and restore use protected Nox commands", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"service.archive": active("admin", "setServiceArchived")'));
  assert.ok(registry.includes('"service.restore": active("admin", "setServiceArchived")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_set_service_archived"'));
  assert.ok(runtime.includes('context.actor.role !== "admin"'));
  assert.ok(!runtime.includes('.from("api_services")') || runtime.indexOf('.from("api_services")') < runtime.indexOf('const setServiceArchived'));
  assert.ok(ui.includes('runAdminCommand(archived?"service.archive":"service.restore"'));
  assert.ok(!ui.includes('.from("api_services").update({archived_at'));
});

test("service dependency mutations use active protected Nox commands", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"service_dependency.create": active("admin", "saveDependency")'));
  assert.ok(registry.includes('"service_dependency.delete": active("admin", "deleteDependency")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_create_service_dependency"'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_delete_service_dependency"'));
  assert.ok(runtime.includes('context.actor.role !== "admin"'));
  assert.ok(runtime.includes('enumValue(input.dependency_type, ["required", "optional"]'));
  assert.ok(ui.includes('runAdminCommand("service_dependency.create"'));
  assert.ok(ui.includes('runAdminCommand("service_dependency.delete"'));
  assert.ok(!ui.includes('.from("api_service_dependencies").insert'));
  assert.ok(!ui.includes('.from("api_service_dependencies").delete'));
});

test("notification broadcast uses an atomic protected Nox command", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"notification.broadcast": active("admin", "broadcastNotification")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_broadcast_notification"'));
  assert.ok(runtime.includes('enumValue(input.type, ["info", "warning", "critical"]'));
  assert.ok(ui.includes('runAdminCommand<{recipient_count:number}>("notification.broadcast"'));
  assert.ok(!ui.includes('.from("user_notifications").insert'));
});

test("service create and update use atomic versioned Nox commands", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"service.create": active("admin", "createService")'));
  assert.ok(registry.includes('"service.update": active("admin", "updateService")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_create_api_service"'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_update_api_service"'));
  assert.ok(runtime.includes("parseServiceInput"));
  assert.ok(ui.includes('runAdminCommand("service.create"'));
  assert.ok(ui.includes('runAdminCommand("service.update"'));
  assert.ok(!ui.includes('.from("api_services").insert'));
  assert.ok(!ui.includes('.from("api_services").update'));
  assert.ok(!ui.includes('.from("api_service_versions").insert'));
});

test("plan and admin limit changes use protected atomic Nox commands", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"plan_limits.update": active("admin", "updatePlanLimits")'));
  assert.ok(registry.includes('"admin_limits.update": active("admin", "updateAdminLimits")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_update_plan_limits"'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_update_limits"'));
  assert.ok(runtime.includes("positiveSafeInteger(input.requests_per_minute"));
  assert.ok(ui.includes('runAdminCommand("plan_limits.update"'));
  assert.ok(ui.includes('runAdminCommand("admin_limits.update"'));
  assert.ok(!ui.includes('.from("api_plan_limits").upsert'));
  assert.ok(!ui.includes('.from("api_admin_limits").upsert'));
});

test("incident lifecycle uses protected atomic Nox commands", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  for (const command of ["incident.create","incident.update","incident.status_change"]) assert.ok(registry.includes('"'+command+'": active('), command);
  for (const rpc of ["bmg_admin_create_incident","bmg_admin_change_incident_status","bmg_admin_add_incident_update"]) assert.ok(runtime.includes('supabase.rpc("'+rpc+'"'), rpc);
  assert.ok(runtime.includes('enumValue(input.severity, ["minor", "major", "critical"]'));
  assert.ok(runtime.includes('enumValue(input.status, ["investigating", "identified", "monitoring", "resolved"]'));
  assert.ok(ui.includes('runAdminCommand("incident.create"'));
  assert.ok(ui.includes('runAdminCommand("incident.status_change"'));
  assert.ok(ui.includes('runAdminCommand("incident.update"'));
  assert.ok(!ui.includes('supabase.from("incidents").insert'));
  assert.ok(!ui.includes('supabase.from("incidents").update'));
  assert.ok(!ui.includes('supabase.from("incident_updates").insert'));
});

test("maintenance configuration and toggles use protected atomic Nox commands", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"maintenance.toggle": active("admin", "setMaintenanceEnabled")'));
  assert.ok(registry.includes('"maintenance.configure": active("admin", "configureMaintenance")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_toggle_maintenance"'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_configure_maintenance"'));
  assert.ok(runtime.includes('p_service_id: serviceId'));
  assert.ok(runtime.includes('p_starts_at: startsAt'));
  assert.ok(runtime.includes('p_ends_at: endsAt'));
  assert.ok(runtime.includes('typeof input.enabled !== "boolean"'));
  assert.ok(ui.includes('runAdminCommand("maintenance.toggle"'));
  assert.ok(ui.includes('runAdminCommand("maintenance.configure",payload)'));
  assert.ok(!ui.includes('.from("maintenance_windows").update({enabled:!m.enabled'));
  assert.ok(!ui.includes('.from("maintenance_windows").insert(payload)'));
  assert.ok(!ui.includes('writeAudit("maintenance.configure"'));
});

test("maintenance configuration migration is invoker-secured and serializes the full write", () => {
  const migration = read("../supabase/migrations/20261125195025_nox_maintenance_configuration_command.sql");
  assert.ok(migration.includes("security invoker"));
  assert.ok(migration.includes("auth.uid()"));
  assert.ok(migration.includes("v_actor_role not in ('admin', 'owner')"));
  assert.ok(migration.includes("pg_advisory_xact_lock"));
  assert.ok(migration.includes("update public.maintenance_windows"));
  assert.ok(migration.includes("insert into public.maintenance_windows"));
  assert.ok(migration.includes("insert into public.audit_logs"));
  assert.ok(migration.includes("grant execute on function public.bmg_admin_configure_maintenance"));
  assert.ok(!migration.includes("service_role"));
});

test("incident command migration is invoker-secured and writes timeline and audit atomically", () => {
  const migration = read("../supabase/migrations/20261125195839_nox_incident_commands.sql");
  for (const name of ["bmg_admin_create_incident","bmg_admin_change_incident_status","bmg_admin_add_incident_update"]) {
    assert.ok(migration.includes("function public."+name), name);
  }
  assert.equal((migration.match(/security invoker/g)||[]).length,3);
  assert.ok(migration.includes("auth.uid()"));
  assert.ok(migration.includes("v_actor_role not in ('admin','owner')"));
  assert.ok(migration.includes("insert into public.incident_updates"));
  assert.ok(migration.includes("insert into public.audit_logs"));
  assert.ok(migration.includes("grant execute on function public.bmg_admin_create_incident"));
  assert.ok(!migration.includes("service_role"));
});

test("limit command migration is invoker-secured and includes audit writes", () => {
  const migration = read("../supabase/migrations/20261125200206_nox_limit_commands.sql");
  for (const name of ["bmg_admin_update_plan_limits","bmg_admin_update_limits"]) {
    assert.ok(migration.includes("function public."+name), name);
  }
  assert.equal((migration.match(/security invoker/g)||[]).length,2);
  assert.ok(migration.includes("auth.uid()"));
  assert.ok(migration.includes("private.bmg_is_admin()"));
  assert.ok(migration.includes("insert into public.audit_logs"));
  assert.ok(migration.includes("on conflict (plan) do update"));
  assert.ok(migration.includes("on conflict (id) do update"));
  assert.ok(!migration.includes("service_role"));
});

test("service create and update migration writes version history and audit atomically", () => {
  const migration = read("../supabase/migrations/20261125200533_nox_service_commands.sql");
  for (const name of ["bmg_admin_create_api_service","bmg_admin_update_api_service"]) {
    assert.ok(migration.includes("function public."+name), name);
  }
  assert.equal((migration.match(/security invoker/g)||[]).length,2);
  assert.ok(migration.includes("auth.uid()"));
  assert.ok(migration.includes("private.bmg_is_admin()"));
  assert.ok(migration.includes("insert into public.api_service_versions"));
  assert.ok(migration.includes("insert into public.audit_logs"));
  assert.ok(migration.includes("for update"));
  assert.ok(!migration.includes("service_role"));
});

test("notification broadcast migration checks role and writes audit atomically", () => {
  const migration = read("../supabase/migrations/20261125200808_nox_notification_broadcast.sql");
  assert.ok(migration.includes("function public.bmg_admin_broadcast_notification"));
  assert.ok(migration.includes("security invoker"));
  assert.ok(migration.includes("private.bmg_is_admin()"));
  assert.ok(migration.includes("insert into public.user_notifications"));
  assert.ok(migration.includes("insert into public.audit_logs"));
  assert.ok(migration.includes("get diagnostics v_recipient_count = row_count"));
  assert.ok(!migration.includes("service_role"));
});

test("export audit events are recorded through a protected Nox command", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  assert.ok(registry.includes('"export.record": active("admin", "recordExport")'));
  assert.ok(runtime.includes('supabase.rpc("bmg_admin_record_export"'));
  assert.ok(runtime.includes('["audit", "requests", "users", "services", "keys", "incidents", "maintenance"]'));
  assert.ok(ui.includes('runAdminCommand("export.record"'));
  assert.ok(!ui.includes('supabase.from("audit_logs").insert'));
});

test("active command registry is fully wired and admin UI has no direct database mutations", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  const runtime = read("../lib/core/commands/admin-command-runtime.ts");
  const ui = read("../components/admin-console.tsx");
  const activeHandlers = [...registry.matchAll(/active\("(?:admin|owner)",\s*"([A-Za-z0-9_]+)"\)/g)].map((match) => match[1]);
  const handlersBlock = runtime.match(/handlers:\s*Object\.freeze\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
  const wiredHandlers = new Set([...handlersBlock.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\b/g)].map((match) => match[1]));
  assert.ok(activeHandlers.length > 0, "registry should expose active commands");
  for (const handler of activeHandlers) assert.ok(wiredHandlers.has(handler), `active handler ${handler} must be registered at runtime`);
  assert.doesNotMatch(ui, /\.from\([^)]*\)\.(?:insert|update|delete|upsert)\s*\(/, "admin UI mutations must pass through Nox commands");
});
