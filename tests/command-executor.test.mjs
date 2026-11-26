import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = (source, fileName) => ts.transpileModule(source, {
  fileName,
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const asModuleUrl = (source) => "data:text/javascript;base64," + Buffer.from(source).toString("base64");

const typesUrl = asModuleUrl(compile(read("../lib/core/commands/command-types.ts"), "command-types.ts"));
const registryUrl = asModuleUrl(compile(read("../lib/core/commands/command-registry.ts"), "command-registry.ts"));
const executorSource = compile(read("../lib/core/commands/command-executor.ts"), "command-executor.ts")
  .replace('"./command-registry"', JSON.stringify(registryUrl))
  .replace('"./command-types"', JSON.stringify(typesUrl));
const { executeAdminCommand } = await import(asModuleUrl(executorSource));

const request = new Request("https://nox.test/api/admin/commands", { method: "POST" });
const deps = (actor, handlers = {}) => ({
  authorize: async () => actor,
  handlers,
});
const execute = (command, actor, handlers = {}, input = {}) =>
  executeAdminCommand({ request, command, input }, deps(actor, handlers));

test("executor rejects unauthenticated requests before invoking handlers", async () => {
  let called = false;
  await assert.rejects(
    execute("service.create", null, { createService: async () => { called = true; } }),
    (error) => error.code === "UNAUTHENTICATED" && error.status === 401,
  );
  assert.equal(called, false);
});

test("executor rejects non-admin roles even if authorization returns an actor", async () => {
  let called = false;
  await assert.rejects(
    execute("service.create", { id: "user-1", role: "user" }, { createService: async () => { called = true; } }),
    (error) => error.code === "FORBIDDEN" && error.status === 403,
  );
  assert.equal(called, false);
});

test("admin cannot execute owner-only commands", async () => {
  let called = false;
  await assert.rejects(
    execute("profile.grant_admin", { id: "admin-1", role: "admin" }, { updateProfile: async () => { called = true; } }),
    (error) => error.code === "FORBIDDEN" && error.status === 403,
  );
  assert.equal(called, false);
});

test("unknown commands are rejected without authorization", async () => {
  let authorized = false;
  await assert.rejects(
    executeAdminCommand({ request, command: "not.registered", input: {} }, {
      authorize: async () => { authorized = true; return { id: "owner-1", role: "owner" }; },
      handlers: {},
    }),
    (error) => error.code === "UNKNOWN_COMMAND" && error.status === 404,
  );
  assert.equal(authorized, false);
});

test("active commands without a registered handler fail closed", async () => {
  await assert.rejects(
    execute("service.create", { id: "admin-1", role: "admin" }),
    (error) => error.code === "HANDLER_UNAVAILABLE" && error.status === 503,
  );
});

test("authorized handler receives immutable actor context and original input", async () => {
  const input = { slug: "example-service" };
  let received;
  const result = await execute("service.create", { id: "owner-1", role: "owner" }, {
    createService: async (value, context) => {
      received = { value, context };
      return { id: "service-1" };
    },
  }, input);

  assert.deepEqual(received.value, input);
  assert.equal(received.context.actor.id, "owner-1");
  assert.equal(received.context.actor.role, "owner");
  assert.equal(received.context.request, request);
  assert.equal(Object.isFrozen(received.context.actor), true);
  assert.equal(result.command, "service.create");
  assert.deepEqual(result.result, { id: "service-1" });
  assert.ok(result.requestId);
});
