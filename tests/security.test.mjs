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

test("API key authorization RPC requires the server secret and rejects the legacy signature", () => {
  const sql = read("../supabase/migrations/20261123100000_secure_api_key_authorization_rpc.sql");
  assert.match(sql, /p_server_secret text/i);
  assert.match(sql, /private\.api_demo_config/i);
  assert.match(sql, /extensions\.digest\(convert_to\(p_server_secret/i);
  assert.match(sql, /drop function public\.bmg_authorize_api_request\(text,text,text\)/i);
  for (const path of ["../app/api/v1/ai/gemini/route.ts", "../app/api/v1/ai/gptfree/route.ts"]) {
    assert.match(read(path), /p_server_secret:\s*process\.env\.BMG_DEMO_RPC_SECRET/);
  }
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

test("admin audit log RPC is restricted to administrators and paginates safely", () => {
  const sql = read("../supabase/migrations/20261121174122_add_admin_audit_log_center.sql");
  assert.match(sql, /if not private\.bmg_is_admin\(\) then/i);
  assert.match(sql, /least\(greatest\(coalesce\(p_page_size,25\),1\),100\)/i);
  assert.match(sql, /revoke all on function public\.bmg_admin_get_audit_logs[\s\S]*from public,anon/i);
  assert.match(sql, /grant execute on function public\.bmg_admin_get_audit_logs[\s\S]*to authenticated/i);
});

test("service dependency management is admin-only and rejects cycles", () => {
  const sql = read("../supabase/migrations/20261121174225_add_service_dependency_management.sql");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /using \(private\.bmg_is_admin\(\)\)/i);
  assert.match(sql, /Service dependency would create a cycle/i);
  assert.match(sql, /before insert or update of service_id,depends_on_service_id/i);
  assert.match(sql, /unique\(service_id,depends_on_service_id\)/i);
});

test("incident updates are public-readable but admin-write-only and append-only", () => {
  const sql = read("../supabase/migrations/20261121174453_add_incident_update_timeline.sql");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /for select to anon,authenticated using \(true\)/i);
  assert.match(sql, /for insert to authenticated with check \(private\.bmg_is_admin\(\)/i);
  assert.match(sql, /grant select on public\.incident_updates to anon,authenticated/i);
  assert.doesNotMatch(sql, /grant update|grant delete/i);
});

test("public status RPC exposes only bounded public incident updates", () => {
  const sql = read("../supabase/migrations/20261121174553_publish_incident_updates_on_status_page.sql");
  assert.match(sql, /limit 20/i);
  assert.match(sql, /'message',u\.message/i);
  assert.match(sql, /'created_at',u\.created_at/i);
  assert.doesNotMatch(sql, /created_by|actor_email|ip_address|user_agent/i);
  assert.match(sql, /grant execute on function public\.bmg_get_public_status\(\) to anon,authenticated/i);
});

test("API key deletion is permanent, serialized with authorization, and audited without secrets", () => {
  const sql = read("../supabase/migrations/20261122231638_hard_delete_api_keys.sql");
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /delete from private\.api_usage/i);
  assert.match(sql, /delete from private\.api_keys/i);
  assert.match(sql, /bmg_revoke_api_key[\s\S]*select public\.bmg_delete_api_key/i);
  assert.match(sql, /bmg_admin_revoke_api_key[\s\S]*select public\.bmg_admin_delete_api_key/i);
  assert.match(sql, /api_key\.admin_delete|api_key\.delete/i);
  assert.doesNotMatch(sql, /set revoked_at\s*=/i);
  const notificationCleanup = read("../supabase/migrations/20261122233346_hard_delete_api_key_notifications.sql");
  assert.match(notificationCleanup, /delete from public\.user_notifications/i);
  assert.match(notificationCleanup, /metadata->>'key_id'/i);
});

test("retired admin features are unscheduled and removed without cascading unrelated tables", () => {
  const sql = read("../supabase/migrations/20261122232258_remove_retired_admin_features.sql");
  assert.match(sql, /nox-reports-scheduler/i);
  assert.match(sql, /nox-webhook-delivery-worker/i);
  assert.match(sql, /drop table if exists public\.api_submissions/i);
  assert.match(sql, /drop table if exists public\.api_webhooks/i);
  assert.match(sql, /drop table if exists public\.api_webhook_deliveries/i);
  assert.match(sql, /drop table if exists public\.report_templates/i);
  assert.match(sql, /drop table if exists public\.report_runs/i);
  assert.match(sql, /drop table if exists public\.report_run_attempts/i);
  assert.match(sql, /drop table if exists private\.api_health_checks/i);
  assert.match(sql, /delete from vault\.secrets/i);
  assert.match(sql, /drop function if exists public\.bmg_webhook_claim_deliveries/i);
  assert.match(sql, /drop function if exists private\.bmg_reports_tick/i);
  assert.doesNotMatch(sql, /drop table[^;]*cascade/i);
  const extensionCleanup = read("../supabase/migrations/20261122233505_remove_unused_pg_net_extension.sql");
  assert.match(extensionCleanup, /drop extension if exists pg_net/i);
});

test("unused PostgreSQL extensions are removed and feedback RLS policies are optimized", () => {
  const extensions = read("../supabase/migrations/20261122234644_remove_unused_http_and_uuid_ossp.sql");
  assert.match(extensions, /drop extension if exists http/i);
  assert.match(extensions, /drop extension if exists "uuid-ossp"/i);

  const feedback = read("../supabase/migrations/20261122234750_optimize_feedback_rls_policies.sql");
  assert.match(feedback, /\(select auth\.uid\(\)\)/i);
  assert.match(feedback, /Users and admins can read feedback/i);
  assert.match(feedback, /\(select private\.bmg_is_admin\(\)\)/i);
  assert.doesNotMatch(feedback, /create policy "Admins can read all feedback"/i);
});


test("admin profile updates reject actors without a profile role", () => {
  const sql = read("../supabase/migrations/20261123075727_harden_admin_profile_missing_role_guard.sql");
  assert.match(sql, /v_actor_role is null or v_actor_role not in \('admin','owner'\)/i);
});


test("Gemini retries share one deadline shorter than the Vercel route limit", () => {
  const service = read("../lib/server/gemini.ts");
  const route = read("../app/api/v1/ai/gemini/route.ts");
  const budget = Number(service.match(/REQUEST_BUDGET_MS\s*=\s*([\d_]+)/)?.[1]?.replaceAll("_", ""));
  const routeLimit = Number(route.match(/maxDuration\s*=\s*(\d+)/)?.[1]);
  assert.equal(routeLimit, 60);
  assert.equal(budget, 50_000);
  assert.match(service, /function timeoutFor\(deadline: number\)/);
  assert.doesNotMatch(service, /AbortSignal\.timeout\(CONFIG\.timeout\)/);
  assert.equal((service.match(/AbortSignal\.timeout\(timeoutFor\(deadline\)\)/g) || []).length, 4);
  assert.match(service, /askGeminiMethod2\(prompt, instruction, previous, deadline\)/);
  assert.match(service, /bootstrap\(deadline\)/);
});
