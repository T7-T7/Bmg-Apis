import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("server service manager registers only known server-side services", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /"aql-gemini"/);
  assert.match(manager, /gptfree/);
  assert.match(manager, /Object\.freeze/);
  assert.match(manager, /getManagedService/);
  assert.doesNotMatch(manager, /eval\s*\(|new Function\s*\(/);
});

test("registered API routes execute through the central service manager", () => {
  const gemini = read("../app/api/v1/ai/gemini/route.ts");
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  assert.match(gemini, /executeManagedService\("aql-gemini", request/);
  assert.match(gptfree, /executeManagedService\("gptfree", request/);
  assert.match(gemini, /p_service_slug:\s*"aql-gemini"/);
  assert.match(gptfree, /p_service_slug:\s*"gptfree"/);
});

test("manager responses are not cacheable and never expose handler source", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /Cache-Control", "no-store"/);
  assert.match(manager, /X-Request-Id/);
  assert.match(manager, /X-Service-Slug/);
  assert.match(manager, /new Response\(response\.body/);
  assert.doesNotMatch(manager, /sourceCode|scriptPath|handler\.toString/);
});
