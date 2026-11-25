import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("server service manifest contains known immutable server-side services", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /"aql-gemini"/);
  assert.match(manager, /gptfree/);
  assert.match(manager, /"star-x"/);
  assert.match(manager, /Object\\.freeze/);
  assert.match(manager, /getManagedService/);
  assert.match(manager, /listManagedServices/);
  assert.match(manager, /authorization: "supabase-rpc"/);
  assert.doesNotMatch(manager, /eval\\s*\\(|new Function\\s*\\(/);
});

test("registered services have unique routes and bounded runtime metadata", () => {
  const manager = read("../lib/server/service-manager.ts");
  const routes = [...manager.matchAll(/route: "(\\/api\\/v1\\/ai\\/[^"]+)"/g)].map((match) => match[1]);
  assert.equal(routes.length, 3);
  assert.equal(new Set(routes).size, routes.length);
  assert.match(manager, /maxDuration: 60/);
  assert.match(manager, /maxDuration: 120/);
  assert.match(manager, /maxDuration: 180/);
  assert.match(manager, /capabilities: Object\\.freeze/);
});

test("registered API routes execute through the compatibility adapter", () => {
  const gemini = read("../app/api/v1/ai/gemini/route.ts");
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  const starx = read("../app/api/v1/ai/star-x/route.ts");
  assert.match(gemini, /executeManagedService\\("aql-gemini", request/);
  assert.match(gptfree, /executeManagedService\\("gptfree", request/);
  assert.match(starx, /executeManagedService\\("star-x", request/);
  for (const route of [gemini, gptfree, starx]) assert.match(route, /managedServiceOptions\\(\\)/);
});

test("core engine owns request identity, method gate, response headers and failure boundary", () => {
  const engine = read("../lib/core/engine/executor.ts");
  assert.match(engine, /randomUUID/);
  assert.match(engine, /request\\.method !== service\\.method/);
  assert.match(engine, /X-Request-Id/);
  assert.match(engine, /X-Service-Manager/);
  assert.match(engine, /X-Service-Slug/);
  assert.match(engine, /Server-Timing/);
  assert.match(engine, /X-Content-Type-Options/);
  assert.match(engine, /onFailure\\(requestId/);
  assert.match(engine, /new Response\\(response\\.body/);
});

test("service manager delegates lifecycle execution to Nox Core", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /executeRequestPipeline/);
  assert.match(manager, /managerName: "Nox Core"/);
  assert.match(manager, /X-Service-Manager", "Nox Core"/);
  assert.match(manager, /Cache-Control": "no-store"/);
  assert.match(manager, /Origin is a browser boundary, not a cryptographic identity mechanism/);
});

test("managed API routes share one consistent CORS preflight policy", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /function managedServiceOptions\\(\\): Response/);
  assert.match(manager, /status: 204/);
  assert.match(manager, /new Response\\(null/);
  assert.match(manager, /Access-Control-Allow-Origin": "\\*"/);
  assert.match(manager, /Access-Control-Allow-Methods": "POST, OPTIONS"/);
  assert.match(manager, /Access-Control-Allow-Headers": "Content-Type, Authorization"/);
  assert.match(manager, /Access-Control-Max-Age": "86400"/);
  assert.match(manager, /Cache-Control": "no-store"/);
});

test("all managed routes retain POST and OPTIONS exports", () => {
  for (const path of [
    "../app/api/v1/ai/gemini/route.ts",
    "../app/api/v1/ai/gptfree/route.ts",
    "../app/api/v1/ai/star-x/route.ts",
  ]) {
    const route = read(path);
    assert.match(route, /export async function OPTIONS\\(\\)/);
    assert.match(route, /return managedServiceOptions\\(\\);/);
    assert.match(route, /export async function POST\\(request: NextRequest\\)/);
  }
});
