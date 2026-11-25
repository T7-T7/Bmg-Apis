import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("server service manifest contains the three immutable registered services", () => {
  const manager = read("../lib/server/service-manager.ts");
  for (const slug of ['"aql-gemini"', "gptfree", '"star-x"']) assert.ok(manager.includes(slug));
  assert.ok(manager.includes("Object.freeze"));
  assert.ok(manager.includes("getManagedService"));
  assert.ok(manager.includes("listManagedServices"));
  assert.ok(manager.includes('authorization: "supabase-rpc"'));
  assert.ok(!manager.includes("new Function("));
  assert.ok(!manager.includes("eval("));
});

test("registered services have unique routes and bounded runtime metadata", () => {
  const manager = read("../lib/server/service-manager.ts");
  const routes = [...manager.matchAll(/route: "(\/api\/v1\/ai\/[^"]+)"/g)].map((match) => match[1]);
  assert.equal(routes.length, 3);
  assert.equal(new Set(routes).size, routes.length);
  for (const duration of ["maxDuration: 60", "maxDuration: 120", "maxDuration: 180"]) {
    assert.ok(manager.includes(duration));
  }
});

test("all registered API routes delegate through the compatibility adapter", () => {
  const routes = [
    ["../app/api/v1/ai/gemini/route.ts", 'executeManagedService("aql-gemini", request'],
    ["../app/api/v1/ai/gptfree/route.ts", 'executeManagedService("gptfree", request'],
    ["../app/api/v1/ai/star-x/route.ts", 'executeManagedService("star-x", request'],
  ];
  for (const [path, call] of routes) {
    const source = read(path);
    assert.ok(source.includes(call), path);
    assert.ok(source.includes("managedServiceOptions()"), path);
    assert.ok(source.includes("export async function OPTIONS()"), path);
  }
});

test("core engine owns request identity, method gate, response headers and failure boundary", () => {
  const engine = read("../lib/core/engine/executor.ts");
  for (const fragment of [
    "randomUUID", "request.method !== service.method", "X-Request-Id",
    "X-Service-Manager", "X-Service-Slug", "Server-Timing",
    "X-Content-Type-Options", "onFailure(requestId", "new Response(response.body",
  ]) assert.ok(engine.includes(fragment), fragment);
});

test("service manager delegates lifecycle execution to Nox Core", () => {
  const manager = read("../lib/server/service-manager.ts");
  for (const fragment of [
    "executeRequestPipeline", 'managerName: "Nox Core"',
    'X-Service-Manager", "Nox Core"', 'Cache-Control": "no-store"',
    "Origin is a browser boundary, not a cryptographic identity mechanism",
  ]) assert.ok(manager.includes(fragment), fragment);
});

test("managed API routes share one consistent CORS preflight policy", () => {
  const manager = read("../lib/server/service-manager.ts");
  for (const fragment of [
    "function managedServiceOptions(): Response", "status: 204", "new Response(null",
    'Access-Control-Allow-Origin": "*"', 'Access-Control-Allow-Methods": "POST, OPTIONS"',
    'Access-Control-Allow-Headers": "Content-Type, Authorization"',
    'Access-Control-Max-Age": "86400"', 'Cache-Control": "no-store"',
  ]) assert.ok(manager.includes(fragment), fragment);
});
