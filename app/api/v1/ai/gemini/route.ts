import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askGemini } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_PROMPT_CHARS = 30_000;
const MAX_BODY_BYTES = 1_048_576;

class PayloadTooLargeError extends Error {}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Request body is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
}
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }});
}
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+((?:nox_live_|bmg_live_)[A-Za-z0-9_-]+)$/i)?.[1];
  if (!token) return jsonError("مفتاح Nox API مطلوب في ترويسة Authorization: Bearer.", 401);

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (cause) {
    if (cause instanceof PayloadTooLargeError) return jsonError("حجم الطلب يتجاوز الحد الأقصى المسموح (1 MB).", 413);
    if (cause instanceof SyntaxError) return jsonError("يجب إرسال جسم الطلب بصيغة JSON صحيحة.", 400);
    return jsonError("تعذر قراءة جسم الطلب.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("يجب أن يكون جسم الطلب كائن JSON.", 400);

  const data = body as Record<string, unknown>;
  if (typeof data.prompt !== "string" || !data.prompt.trim()) return jsonError("الحقل prompt مطلوب ويجب أن يحتوي على نص.", 400);
  if (data.prompt.length > MAX_PROMPT_CHARS) return NextResponse.json({
    success: false, error: "تجاوز النص الحد الأقصى المسموح وهو 30000 حرف.",
    maxLength: MAX_PROMPT_CHARS, receivedLength: data.prompt.length,
  }, { status: 413, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
  if (data.instruction !== undefined && typeof data.instruction !== "string") return jsonError("الحقل instruction يجب أن يكون نصًا.", 400);
  if (data.sessionId !== undefined && typeof data.sessionId !== "string") return jsonError("الحقل sessionId يجب أن يكون نصًا.", 400);

  try {
    const { data: access, error } = await getSupabase().rpc("bmg_authorize_api_request", {
      p_key: token, p_service_slug: "aql-gemini", p_method: "POST",
    });
    if (error) {
      console.error("[Nox API key validation]", error.message);
      return jsonError("تعذر التحقق من مفتاح API حاليًا.", 503);
    }
    const result = access as { authorized?: boolean; reason?: string } | null;
    if (!result?.authorized) {
      if (result?.reason === "rate_limited") return jsonError("تجاوزت حد 30 طلبًا في الدقيقة لهذا المفتاح.", 429);
      if (result?.reason === "service_unavailable") return jsonError("الخدمة غير متاحة حاليًا.", 503);
      return jsonError("مفتاح API غير صحيح أو ملغى أو منتهي الصلاحية.", 401);
    }
    const response = await askGemini({
      prompt: data.prompt,
      instruction: typeof data.instruction === "string" ? data.instruction : undefined,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    });
    return NextResponse.json(response, { headers: {
      "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store",
      "X-Max-Prompt-Length": String(MAX_PROMPT_CHARS),
    }});
  } catch (error) {
    console.error("[Nox Gemini API]", error instanceof Error ? error.message : error);
    return jsonError("تعذر تنفيذ الخدمة حاليًا. حاول مرة أخرى لاحقًا.", 502);
  }
}