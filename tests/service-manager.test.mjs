import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("server service manifest contains known immutable server-side services", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /"aql-gemini"/);
  assert.match(manager, /gptfree/);
  assert.match(manager, /"star-x"/);
  assert.match(manager, /Object\.freeze/);
  assert.match(manager, /getManagedService/);
  assert.match(manager, /listManagedServices/);
  assert.match(manager, /authorization: "supabase-rpc"/);
  assert.doesNotMatch(manager, /eval\s*\(|new Function\s*\(/);
});

test("registered services have unique routes and bounded runtime metadata", () => {
  const manager = read("../lib/server/service-manager.ts");
  const routes = [...manager.matchAll(/route: "(\/api\/v1\/ai\/[^"]+)"/g)].map((match) => match[1]);
  assert.equal(routes.length, 3);
  assert.equal(new Set(routes).size, routes.length);
  assert.match(manager, /maxDuration: 60/);
  assert.match(manager, /maxDuration: 120/);
  assert.match(manager, /maxDuration: 180/);
  assert.match(manager, /capabilities: Object\.freeze/);
});

test("registered API routes execute through the central service manager", () => {
  const gemini = read("../app/api/v1/ai/gemini/route.ts");
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  const starx = read("../app/api/v1/ai/star-x/route.ts");
  assert.match(gemini, /executeManagedService\("aql-gemini", request/);
  assert.match(gptfree, /executeManagedService\("gptfree", request/);
  assert.match(starx, /executeManagedService\("star-x", request/);
  for (const route of [gemini, gptfree, starx]) assert.match(route, /managedServiceOptions\(\)/);
  assert.match(gemini, /p_service_slug:\s*"aql-gemini"/);
  assert.match(gptfree, /p_service_slug:\s*"gptfree"/);
  assert.match(starx, /p_service_slug:\s*"star-x"/);
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
  assert.match(manager, /new Response\(response\.body/);
  assert.doesNotMatch(manager, /sourceCode|scriptPath|handler\.toString/);
});

test("managed API routes share one consistent CORS preflight policy", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /function managedServiceOptions\(\): Response/);
  assert.match(manager, /status: 204/);
  assert.match(manager, /new Response\(null/);
  assert.match(manager, /Access-Control-Allow-Origin": "\*"/);
  assert.match(manager, /Access-Control-Allow-Methods": "POST, OPTIONS"/);
  assert.match(manager, /Access-Control-Allow-Headers": "Content-Type, Authorization"/);
  assert.match(manager, /Access-Control-Max-Age": "86400"/);
  assert.match(manager, /Cache-Control": "no-store"/);
});

test("every managed API route exports OPTIONS and delegates preflight to the shared policy", () => {
  const routes = [
    ["aql-gemini", read("../app/api/v1/ai/gemini/route.ts")],
    ["gptfree", read("../app/api/v1/ai/gptfree/route.ts")],
    ["star-x", read("../app/api/v1/ai/star-x/route.ts")],
  ];

  for (const [slug, source] of routes) {
    assert.match(source, /export async function OPTIONS\(\)/, `${slug} must expose OPTIONS`);
    assert.match(source, /return managedServiceOptions\(\);/, `${slug} must use shared preflight headers`);
    assert.match(source, /export async function POST\(request: NextRequest\)/, `${slug} must expose POST`);
  }
});

test("manager errors include the same trace headers without exposing exception details", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /function managerError\([\s\S]*?X-Request-Id/);
  assert.match(manager, /X-Service-Manager/);
  assert.match(manager, /X-Service-Slug/);
  assert.match(manager, /Server-Timing/);
  assert.match(manager, /X-Content-Type-Options", "nosniff"/);
  assert.match(manager, /errorName: cause instanceof Error \? cause\.name/);
  assert.doesNotMatch(manager, /error: cause instanceof Error \? cause\.message/);
  assert.match(manager, /METHOD_NOT_ALLOWED/);
});

test("GPTFree maps service state, permission and quota failures to correct HTTP statuses", () => {
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  assert.match(gptfree, /reason === "service_unavailable"[\s\S]*?\? 503/);
  assert.match(gptfree, /reason === "account_suspended"[\s\S]*?\? 403/);
  assert.match(gptfree, /reason === "insufficient_scope"[\s\S]*?\? 403/);
  assert.match(gptfree, /reason === "rate_limited"[\s\S]*?\? 429/);
});


test("no-key demo authorization is restricted to the official website Origin", () => {
  const manager = read("../lib/server/service-manager.ts");
  assert.match(manager, /function isWebsiteTestRequest\(request: Request\): boolean/);
  assert.match(manager, /process\.env\.NOX_SITE_ORIGIN \|\| "https:\/\/nox\.bmg-inc\.web\.id"/);
  assert.match(manager, /return origin === configuredOrigin/);
  for (const path of [
    "../app/api/v1/ai/gemini/route.ts",
    "../app/api/v1/ai/gptfree/route.ts",
    "../app/api/v1/ai/star-x/route.ts",
  ]) {
    const route = read(path);
    assert.match(route, /!token && !isWebsiteTestRequest\(request\)/);
    assert.match(route, /يلزم إرسال API Key صالح للطلبات الخارجية/);
  }
});

test("OpenAPI declares API keys mandatory for external API clients", () => {
  const openapi = read("../app/api/openapi.json/route.ts");
  assert.equal((openapi.match(/security: \[\{ NoxApiKey: \[\] \}\]/g) || []).length, 3);
  assert.doesNotMatch(openapi, /security: \[\{\}, \{ NoxApiKey: \[\] \}\]/);
  assert.match(openapi, /الطلبات الخارجية تتطلب API Key/);
  assert.match(openapi, /صفحات الاختبار داخل الموقع تعمل دون API Key/);
});

test("public developer documentation matches the three active services and canonical domain", () => {
  const docs = read("../app/docs.md/route.ts");
  const llms = read("../app/llms.txt/route.ts");
  for (const source of [docs, llms]) {
    assert.ok(source.includes("nox.bmg-inc.web.id"));
    assert.ok(source.includes("/api/v1/ai/gemini"));
    assert.ok(source.includes("/api/v1/ai/gptfree"));
    assert.ok(source.includes("/api/v1/ai/star-x"));
    assert.ok(!source.includes("/api/v1/currency/rate"));
    assert.ok(!source.includes("starx.bmg-inc.web.id"));
    assert.ok(!source.includes("bmg-apis-b2-902b.vercel.app"));
  }
});

test("official Star X test page does not request or send an API key", () => {
  const page = read("../components/star-x-pages.tsx");
  const testPage = page.slice(page.indexOf("export function StarXTest()"));
  assert.doesNotMatch(testPage, /apiKey|Authorization:\s*["']Bearer|مفتاح API/);
  assert.match(testPage, /يعمل من الموقع الرسمي دون إدخال مفتاح API/);
});
