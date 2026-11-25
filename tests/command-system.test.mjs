import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("command registry is a fixed allowlist of existing admin operations", () => {
  const registry = read("../lib/core/commands/command-registry.ts");
  for (const command of [
    "profile.update", "profile.grant_admin", "service.create", "service.update",
    "service.archive", "service.restore", "service.rollback", "api_key.update",
    "api_key.delete", "plan_limits.update", "admin_limits.update",
    "notification.broadcast", "incident.create", "incident.update",
    "incident.status_change", "service_dependency.create",
    "service_dependency.delete", "maintenance.configure", "maintenance.toggle",
  ]) assert.ok(registry.includes('"'+command+'"'), command);
  assert.ok(registry.includes("Object.freeze"));
  assert.ok(registry.includes("getAdminCommand"));
  assert.ok(registry.includes("hasOwnProperty.call"));
  assert.ok(!registry.includes("eval("));
  assert.ok(!registry.includes("new Function("));
});

test("command executor resolves authorization from the request before invoking a handler", () => {
  const executor = read("../lib/core/commands/command-executor.ts");
  const authIndex = executor.indexOf("dependencies.authorize(input.request)");
  const handlerIndex = executor.indexOf("await handler(input.input");
  assert.ok(authIndex >= 0);
  assert.ok(handlerIndex > authIndex);
  for (const fragment of [
    'actor.role !== "admin" && actor.role !== "owner"',
    'definition.permission === "owner"',
    "dependencies.handlers[definition.handler]",
    "AdminCommandError",
    "randomUUID",
  ]) assert.ok(executor.includes(fragment), fragment);
});

test("command authorization contract rejects client-supplied identity as a trust source", () => {
  const executor = read("../lib/core/commands/command-executor.ts");
  assert.ok(executor.includes("verified server-side session"));
  assert.ok(executor.includes("Never implement this using a role, user ID, or permission sent by the client"));
  assert.ok(executor.includes("Server-owned handlers only"));
});
