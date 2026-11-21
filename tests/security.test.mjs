import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("API key update RPC is not executable by anonymous/public roles", () => {
  const sql = read("../supabase/migrations/20261121030941_tighten_api_rpc_execute_grants.sql");
  assert.match(sql, /revoke all on function public\.bmg_update_api_key\(uuid, text, timestamptz\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.bmg_update_api_key\(uuid, text, timestamptz\) to authenticated/i);
});

test("protected routes are verified on the server before rendering", () => {
  const proxy = read("../proxy.ts");
  assert.match(proxy, /supabase\.auth\.getClaims\(\)/);
  assert.match(proxy, /protectedRoute && !claims/);
  assert.match(proxy, /NextResponse\.redirect/);
  assert.match(proxy, /Cache-Control/);
});

test("server-only credentials are not referenced by browser application modules", () => {
  const roots = ["../app", "../components", "../lib/supabase"];
  const forbidden = /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|BMG_DEMO_RPC_SECRET|GPTFREE_FIREBASE_API_KEY)/;
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "api" && dir.endsWith("/app") ? [] : walk(path);
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !path.includes("/api/") ? [path] : [];
  });
  for (const root of roots) for (const file of walk(new URL(root, import.meta.url).pathname)) {
    assert.doesNotMatch(readFileSync(file, "utf8"), forbidden, file);
  }
});

test("both public API routes enforce bounded request payloads", () => {
  const gemini = read("../app/api/v1/ai/gemini/route.ts");
  const gptfree = read("../app/api/v1/ai/gptfree/route.ts");
  assert.match(gemini, /MAX_BODY_BYTES\s*=\s*1_048_576/);
  assert.match(gptfree, /MAX_BODY\s*=\s*1_048_576/);
  assert.match(gptfree, /request\.body\?\.getReader\(\)/);
  assert.match(gptfree, /await reader\.cancel\(\)/);
  assert.doesNotMatch(gptfree, /await request\.text\(\)/);
});

test("GPTFree upstream and Firebase timeouts fit the 120-second route budget", () => {
  const route = read("../app/api/v1/ai/gptfree/route.ts");
  const duration = Number(route.match(/maxDuration\s*=\s*(\d+)/)?.[1]);
  const firebaseTimeouts = [...route.matchAll(/AbortSignal\.timeout\((\d+)_000\)/g)].map((match) => Number(match[1]));
  assert.equal(duration, 120);
  assert.deepEqual(firebaseTimeouts.sort((a, b) => a - b), [10, 10, 90]);
  assert.ok(10 + 10 + 90 < duration, "Firebase refresh + fresh auth + provider timeout must fit the route budget");
});

test("administrator role boundaries are enforced by the database RPC", () => {
  const sql = read("../supabase/migrations/20261121173724_protect_admin_role_boundaries.sql");
  assert.match(sql, /v_actor_role='admin' and v_target_role<>'user'/i);
  assert.match(sql, /Administrators cannot modify another administrator/i);
  assert.match(sql, /Only the owner can grant administrator access/i);
  assert.match(sql, /v_target_role='owner'/i);
});

test("admin request log RPC is role-gated and never returns network/device identifiers", () => {
  const sql = read("../supabase/migrations/20261121173846_add_admin_request_log_center.sql");
  assert.match(sql, /if not private\.bmg_is_admin\(\) then/i);
  assert.match(sql, /created_at>=now\(\)-make_interval\(hours=>v_hours\)/i);
  assert.match(sql, /revoke all on function public\.bmg_admin_get_request_logs[\s\S]*from public,anon/i);
  assert.match(sql, /grant execute on function public\.bmg_admin_get_request_logs[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /ip_address|user_agent|device_id|request_body/i);
});
