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
  assert.ok(runtime.includes('.from("api_services")'));
  assert.ok(runtime.includes('.from("audit_logs").insert'));
  assert.ok(runtime.includes('context.actor.role !== "admin"'));
  assert.ok(ui.includes('runAdminCommand(archived?"service.archive":"service.restore"'));
  assert.ok(!ui.includes('.from("api_services").update({archived_at'));
});
