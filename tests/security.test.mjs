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

test("protected routes are gated before protected content is rendered", () => {
  const portal = read("../components/portal.tsx");
  assert.match(portal, /isProtectedPage=pathname===\"\/playground\"\|\|pathname===\"\/dashboard\"\|\|pathname\.startsWith\(\"\/dashboard\/\"\)/);
  assert.match(portal, /!authReady\|\|\(user&&isAuthPage\)\|\|\(!user&&isProtectedPage\)/);
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
});
