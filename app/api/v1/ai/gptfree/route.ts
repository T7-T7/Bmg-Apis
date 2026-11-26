import { NextRequest, NextResponse } from "next/server";
import { executeManagedService, isWebsiteTestRequest, managedServiceOptions } from "@/lib/server/service-manager";
import { createClient } from "@supabase/supabase-js";
import { parseApiKeyAuthorization, createDemoClientHash } from "@/lib/core/managers/auth-manager";
import { completeUsageTracking } from "@/lib/core/managers/usage-manager";
import { PayloadTooLargeError, readJsonRequestBody } from "@/lib/core/managers/request-manager";

export const runtime = "nodejs";
export const maxDuration = 120;

const AGENT_URL = "https://us-central1-gptfree-2.cloudfunctions.net/agent_stream";
const MAX_BODY = 1_048_576;
const MAX_HISTORY = 20;
const MAX_MESSAGE = 30_000;

type AuthState = { idToken: string; refreshToken: string; expiresAt: number };
let authState: AuthState | null = null;
let authPromise: Promise<AuthState> | null = null;

function error(message: string, status: number) {
  const code = status === 400 ? "INVALID_REQUEST"
    : status === 401 ? "UNAUTHORIZED"
    : status === 413 ? "PAYLOAD_TOO_LARGE"
    : status === 429 ? "RATE_LIMITED"
    : status === 403 ? "FORBIDDEN"
    : status === 503 ? "SERVICE_UNAVAILABLE"
    : status === 504 ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  };
  if (status === 429 || status === 503 || status === 504) headers["Retry-After"] = "30";
  return NextResponse.json({ success: false, error: message, code }, { status, headers });
}
async function completeUsage(id: number | null, status: number, startedAt: number) {
  return completeUsageTracking({
    usageId: id,
    complete: async () => {
      const { error } = await supabase().rpc("bmg_complete_api_request", {
        p_usage_id: id as number, p_status_code: status,
        p_latency_ms: Math.max(0, Date.now() - startedAt),
        p_server_secret: process.env.BMG_DEMO_RPC_SECRET
      });
      if (error) throw error;
    },
    onError: (cause) => console.error("[Nox usage completion]", cause instanceof Error ? cause.message : cause)
  });
}
function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function clientHash(request: NextRequest) { return createDemoClientHash(request, process.env.GEMINI_SESSION_SECRET, "Session secret is not configured."); }
async function authorize(request: NextRequest, token: string | null) {
  if (!token && !isWebsiteTestRequest(request)) return { ok: false as const, response: error("يلزم إرسال API Key صالح للطلبات الخارجية.", 401) };
  const db = supabase();
  if (token) {
    const { data, error: rpcError } = await db.rpc("bmg_authorize_api_request", {
      p_key: token, p_service_slug: "gptfree", p_method: "POST", p_server_secret: process.env.BMG_DEMO_RPC_SECRET
    });
    if (rpcError) throw rpcError;
    const result = data as { authorized?: boolean; reason?: string; usage_id?: number; message?: string } | null;
    if (!result?.authorized) {
      const reason = result?.reason;
      const status = reason === "rate_limited" ? 429
        : reason === "account_suspended" || reason === "insufficient_scope" ? 403
        : reason === "maintenance" || reason === "service_unavailable" ? 503 : 401;
      const message = reason === "rate_limited" ? "تجاوزت حدود الاستخدام المسموح بها لحسابك أو مفتاحك."
        : reason === "maintenance" ? (result?.message || "الخدمة تحت الصيانة مؤقتًا.")
        : reason === "service_unavailable" ? "الخدمة غير متاحة حاليًا."
        : reason === "account_suspended" ? "تم إيقاف الحساب مؤقتًا. تواصل مع الإدارة."
        : reason === "insufficient_scope" ? "مفتاح API لا يملك صلاحية استخدام هذه الخدمة."
        : "مفتاح API غير صالح أو ملغى أو منتهي.";
      return { ok: false as const, response: error(message, status) };
    }
    return { ok: true as const, usageId: Number(result.usage_id) || null };
  }
  const { data, error: rpcError } = await db.rpc("bmg_authorize_demo_request", {
    p_client_hash: clientHash(request), p_service_slug: "gptfree", p_method: "POST",
    p_server_secret: process.env.BMG_DEMO_RPC_SECRET
  });
  if (rpcError) throw rpcError;
  const result = data as { authorized?: boolean; reason?: string; usage_id?: number; message?: string } | null;
  if (!result?.authorized) {
    const reason = result?.reason;
    const status = reason === "rate_limited" ? 429 : 503;
    const message = reason === "rate_limited" ? "وصلت إلى حد التجربة المجانية."
      : reason === "maintenance" ? (result?.message || "الخدمة تحت الصيانة مؤقتًا.")
      : "الخدمة غير متاحة حاليًا.";
    return { ok: false as const, response: error(message, status) };
  }
  return { ok: true as const, usageId: Number(result.usage_id) || null };
}
async function firebaseRequest(url: string, body: Record<string, string | boolean>) {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.error && (data.error as Record<string, unknown>).message || "Firebase authentication failed"));
  return data;
}
async function getAuth(force = false): Promise<AuthState> {
  if (!force && authState && authState.expiresAt > Date.now() + 60_000) return authState;
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const key = process.env.GPTFREE_FIREBASE_API_KEY;
    if (!key) throw new Error("GPTFREE_FIREBASE_API_KEY is not configured.");
    let data: Record<string, unknown>;
    if (!force && authState?.refreshToken) {
      try {
        const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: authState.refreshToken });
        const response = await fetch("https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(key), {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form, cache: "no-store", signal: AbortSignal.timeout(10_000)
        });
        data = await response.json() as Record<string, unknown>;
        if (!response.ok) throw new Error("Firebase token refresh failed");
        authState = {
          idToken: String(data.id_token), refreshToken: String(data.refresh_token),
          expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000
        };
        return authState;
      } catch { authState = null; }
    }
    data = await firebaseRequest("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(key), { returnSecureToken: true });
    authState = {
      idToken: String(data.idToken), refreshToken: String(data.refreshToken),
      expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000
    };
    return authState;
  })().finally(() => { authPromise = null; });
  return authPromise;
}
async function requestAgent(payload: { message: string; images: string[]; history: unknown[] }, retry = true) {
  const auth = await getAuth();
  const response = await fetch(AGENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Authorization: "Bearer " + auth.idToken,
      "Origin": "https://gptfree.com", "Referer": "https://gptfree.com/",
      "User-Agent": "Nox-Apis/1.0"
    },
    body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(90_000)
  });
  if ((response.status === 401 || response.status === 403) && retry) {
    authState = null;
    return requestAgent(payload, false);
  }
  if (!response.ok) throw new Error("GPTFree upstream returned HTTP " + response.status);
  return response;
}
export async function OPTIONS() {
  return managedServiceOptions();
}
async function handlePost(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const apiKey = parseApiKeyAuthorization(authorization);
  if (!apiKey.valid) return error("صيغة ترويسة Authorization غير صحيحة.", 401);
  let body: unknown;
  try {
    body = await readJsonRequestBody(request, MAX_BODY);
  } catch (cause) {
    if (cause instanceof PayloadTooLargeError) return error("حجم الطلب يتجاوز 1 MB.", 413);
    return error("يجب إرسال جسم الطلب بصيغة JSON صحيحة.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return error("جسم الطلب غير صالح.", 400);
  const data = body as Record<string, unknown>;
  if (typeof data.message !== "string" || !data.message.trim()) return error("الحقل message مطلوب.", 400);
  if (data.message.length > MAX_MESSAGE) return error("تجاوز message الحد الأقصى البالغ 30000 حرف.", 413);
  const history = Array.isArray(data.history) ? data.history.slice(-MAX_HISTORY) : [];
  if (history.some(item => !item || typeof item !== "object" ||
    !["user", "agent", "assistant"].includes(String((item as Record<string, unknown>).type)) ||
    typeof (item as Record<string, unknown>).content !== "string")) return error("صيغة history غير صحيحة.", 400);
  let usageId:number|null=null;const startedAt=Date.now();
  try {
    const access = await authorize(request, apiKey.token);
    if (!access.ok) return access.response;
    usageId=access.usageId??null;
    const upstream = await requestAgent({ message: data.message, images: [], history });
    const raw = await upstream.text();
    let responseText = "";
    let upstreamError = "";
    for (const block of raw.split(/\r?\n\r?\n/)) {
      let event = "";
      const lines = block.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) {
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
            if (event === "error") upstreamError = String(parsed.error || "تعذر الحصول على رد من GPTFree.");
            if (event === "result" && typeof parsed.response === "string") responseText += parsed.response;
          } catch { /* Ignore non-JSON SSE frames. */ }
        }
      }
    }
    if (upstreamError){await completeUsage(usageId,502,startedAt);return error("واجه مزود GPTFree مشكلة أثناء إنشاء الرد.", 502)}
    if (!responseText.trim()){await completeUsage(usageId,502,startedAt);return error("لم يُرجع مزود GPTFree محتوى صالحًا.", 502)}
    await completeUsage(usageId,200,startedAt);
    return NextResponse.json({ success: true, response: responseText, provider: "gptfree", access: apiKey.token ? "api_key" : "demo" }, {
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }
    });
  } catch (cause) {
    await completeUsage(usageId,502,startedAt);
    console.error("[Nox GPTFree API]", cause instanceof Error ? cause.message : cause);
    return error("تعذر تنفيذ GPTFree حاليًا. تحقق من إعداد المفتاح وحاول لاحقًا.", 502);
  }
}


export async function POST(request: NextRequest) {
  return executeManagedService("gptfree", request, () => handlePost(request));
}
