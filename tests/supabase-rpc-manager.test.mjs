import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Nox Core owns request-scoped Supabase RPC client configuration", () => {
  const manager = read("../lib/core/managers/supabase-rpc-manager.ts");
  for (const fragment of [
    'import { createClient } from "@supabase/supabase-js"',
    "export type ManagedSupabaseRpc",
    "export function createManagedSupabaseRpc()",
    "process.env.NEXT_PUBLIC_SUPABASE_URL",
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "persistSession: false",
    "autoRefreshToken: false",
    "client.rpc(procedure, args as never)",
  ]) assert.ok(manager.includes(fragment), fragment);
});

test("Nox access manager creates and shares the request-scoped RPC transport", () => {
  const access = read("../lib/core/managers/managed-access-manager.ts");
  assert.ok(access.includes("createManagedSupabaseRpc()"));
  assert.ok(access.includes("authorizeManagedRequest({"));
  assert.ok(access.includes("return Object.freeze({ rpc, authorization })"));
});

test("each AI route obtains its shared RPC transport through Nox access manager", () => {
  const routes = [
    "../app/api/v1/ai/gemini/route.ts",
    "../app/api/v1/ai/gptfree/route.ts",
    "../app/api/v1/ai/star-x/route.ts",
  ];

  for (const path of routes) {
    const route = read(path);
    assert.ok(route.includes("authorizeManagedServiceRequest"), path);
    assert.match(route, /completeManagedUsageTracking\\(\\{[\\s\\S]*?\\brpc,/);
    assert.doesNotMatch(route, /createManagedSupabaseRpc\\(/);
    assert.doesNotMatch(route, /authorizeManagedRequest\\(/);
    assert.doesNotMatch(route, /from ["']@supabase\\/supabase-js["']/);
    assert.doesNotMatch(route, /createClient\\(/);
  }
});
