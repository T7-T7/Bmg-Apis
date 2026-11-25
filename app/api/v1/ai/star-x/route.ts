import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { executeManagedService, isWebsiteTestRequest, managedServiceOptions } from "@/lib/server/service-manager";
import { aiScenes, text2image, aiBackground, aiShadows } from "@/services/photoroom.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_BODY = 1_048_576;
const MAX_PROMPT = 4000;
class PayloadTooLargeError extends Error {}

async function readBody(request: NextRequest): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_BODY) throw new PayloadTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Request body is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) { await reader.cancel(); throw new PayloadTooLargeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function clientHash(request: NextRequest) {
  const secret = process.env.GEMINI_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("GEMINI_SESSION_SECRET is not configured.");
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex");
}
function fail(message: string, status: number) {
  const code = status === 400 ? "INVALID_REQUEST" : status === 401 ? "UNAUTHORIZED"
    : status === 403 ? "FORBIDDEN" : status === 413 ? "PAYLOAD_TOO_LARGE"
    : status === 429 ? "RATE_LIMITED" : status === 503 ? "SERVICE_UNAVAILABLE" : "UPSTREAM_ERROR";
  const headers: Record<string, string> = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
  if (status === 429 || status === 503) headers["Retry-After"] = "30";
  return NextResponse.json({ success: false, error: message, code }, { status, headers });
}
async function authorize(request: NextRequest, token: string | null) {
  if (!token && !isWebsiteTestRequest(request)) return { ok: false as const, response: fail("يلزم إرسال API Key صالح للطلبات الخارجية.", 401) };
  const client = db();
  if (token) {
    const { data, error } = await client.rpc("bmg_authorize_api_request", {
      p_key: token, p_service_slug: "star-x", p_method: "POST",
      p_server_secret: process.env.BMG_DEMO_RPC_SECRET
    });
    if (error) throw error;
    const result = data as { authorized?: boolean; reason?: string; usage_id?: number; message?: string } | null;
    if (!result?.authorized) {
      const reason = result?.reason;
      const status = reason === "rate_limited" ? 429
        : reason === "account_suspended" || reason === "insufficient_scope" ? 403
        : reason === "maintenance" || reason === "service_unavailable" ? 503 : 401;
      const message = reason === "rate_limited" ? "تجاوزت حد الطلبات المسموح لهذا المفتاح."
        : reason === "maintenance" ? (result?.message || "الخدمة تحت الصيانة مؤقتًا.")
        : reason === "service_unavailable" ? "الخدمة غير متاحة حاليًا."
        : reason === "account_suspended" ? "تم إيقاف الحساب مؤقتًا."
        : reason === "insufficient_scope" ? "مفتاح API لا يملك صلاحية هذه الخدمة."
        : "مفتاح API غير صالح أو ملغى أو منتهي الصلاحية.";
      return { ok: false as const, response: fail(message, status) };
    }
    return { ok: true as const, usageId: Number(result.usage_id) || null };
  }
  const { data, error } = await client.rpc("bmg_authorize_demo_request", {
    p_client_hash: clientHash(request), p_service_slug: "star-x", p_method: "POST",
    p_server_secret: process.env.BMG_DEMO_RPC_SECRET
  });
  if (error) throw error;
  const result = data as { authorized?: boolean; reason?: string; usage_id?: number; message?: string } | null;
  if (!result?.authorized) {
    const limited = result?.reason === "rate_limited";
    return { ok: false as const, response: fail(limited ? "وصلت إلى حد التجربة المجانية." : result?.message || "الخدمة غير متاحة حاليًا.", limited ? 429 : 503) };
  }
  return { ok: true as const, usageId: Number(result.usage_id) || null };
}
async function completeUsage(id: number | null, status: number, startedAt: number) {
  if (!id) return;
  try {
    await db().rpc("bmg_complete_api_request", {
      p_usage_id: id, p_status_code: status, p_latency_ms: Math.max(0, Date.now() - startedAt),
      p_server_secret: process.env.BMG_DEMO_RPC_SECRET
    });
  } catch (error) { console.error("[Star X usage completion]", error instanceof Error ? error.message : error); }
}
function validImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try { const url = new URL(value); return url.protocol === "https:"; } catch { return false; }
}
async function handlePost(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+((?:nox_live_|bmg_live_)[A-Za-z0-9_-]+)$/i);
  if (auth && !match) return fail("صيغة Authorization غير صحيحة.", 401);
  let body: unknown;
  try { body = await readBody(request); }
  catch (cause) {
    if (cause instanceof PayloadTooLargeError) return fail("حجم الطلب يتجاوز 1 MB.", 413);
    return fail("يجب إرسال جسم الطلب بصيغة JSON صحيحة.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("جسم الطلب غير صالح.", 400);
  const data = body as Record<string, unknown>;
  const action = data.action;
  const needsImage = action === "edit-scene" || action === "change-background" || action === "improve-lighting";
  if (!["edit-scene", "generate-image", "change-background", "improve-lighting"].includes(String(action))) {
    return fail("قيمة action غير مدعومة.", 400);
  }
  if (needsImage && !validImageUrl(data.imageUrl)) return fail("الحقل imageUrl مطلوب ويجب أن يكون رابط HTTPS صالحًا.", 400);
  if ((action === "edit-scene" || action === "change-background" || action === "generate-image") &&
      (typeof data.prompt !== "string" || !data.prompt.trim() || data.prompt.length > MAX_PROMPT)) {
    return fail("الحقل prompt مطلوب، وبحد أقصى 4000 حرف.", 400);
  }
  if (typeof data.prompt === "string" && /[\u0600-\u06FF]/.test(data.prompt)) {
    return fail("Star X يقبل التعليمات باللغة الإنجليزية فقط. اكتب prompt باللغة الإنجليزية.", 400);
  }

  const startedAt = Date.now();
  let usageId: number | null = null;
  try {
    const access = await authorize(request, match?.[1] ?? null);
    if (!access.ok) return access.response;
    usageId = access.usageId;
    const options = { timeoutMs: 150000 };
    const result = action === "edit-scene"
      ? await aiScenes(data.imageUrl as string, data.prompt as string, options)
      : action === "generate-image"
        ? await text2image(data.prompt as string, options)
        : action === "change-background"
          ? await aiBackground(data.imageUrl as string, data.prompt as string, options)
          : await aiShadows(data.imageUrl as string, options);
    await completeUsage(usageId, 200, startedAt);
    const buffer = result.buffer;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType || "image/png",
        "Content-Length": String(buffer.length),
        "Content-Disposition": 'inline; filename="star-x-result.png"',
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "X-Star-X-Action": String(action),
        "X-Star-X-Image-Id": String(result.imageId || "")
      }
    });
  } catch (error) {
    await completeUsage(usageId, 502, startedAt);
    console.error("[Star X API]", error instanceof Error ? error.message : error);
    return fail("تعذر تنفيذ Star X حاليًا. حاول مرة أخرى لاحقًا.", 502);
  }
}
export async function OPTIONS() {
  return managedServiceOptions();
}
export async function POST(request: NextRequest) {
  return executeManagedService("star-x", request, () => handlePost(request));
}
