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

test("registered API routes execute through the central service manager", () => {
  const gemini = read("../app/api/v1/ai/gemini/route.ts");
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  const starx = read("../app/api/v1/ai/star-x/route.ts");
  assert.match(gemini, /executeManagedService\\("aql-gemini", request/);
  assert.match(gptfree, /executeManagedService\\("gptfree", request/);
  assert.match(starx, /executeManagedService\\("star-x", request/);
  assert.match(gemini, /p_service_slug:\\s*"aql-gemini"/);
  assert.match(gptfree, /p_service_slug:\\s*"gptfree"/);
  assert.match(starx, /p_service_slug:\\s*"star-x"/);
  assert.match(starx, /aiScenes/);
  assert.match(starx, /text2image/);
  assert.match(starx, /aiBackground/);
  assert.match(starx, /aiShadows/);
});

test("manager responses are not cacheable and never expose handler source", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /Cache-Control", "no-store"/);
  assert.match(manager, /X-Request-Id/);
  assert.match(manager, /X-Service-Slug/);
  assert.match(manager, /new Response\\(response\\.body/);
  assert.doesNotMatch(manager, /sourceCode|scriptPath|handler\\.toString/);
});

test("GPTFree maps service state, permission and quota failures to correct HTTP statuses", () => {
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  assert.match(gptfree, /reason === "service_unavailable"[\\s\\S]*?\\? 503/);
  assert.match(gptfree, /reason === "account_suspended"[\\s\\S]*?\\? 403/);
  assert.match(gptfree, /reason === "insufficient_scope"[\\s\\S]*?\\? 403/);
  assert.match(gptfree, /reason === "rate_limited"[\\s\\S]*?\\? 429/);
});
