import { NextRequest, NextResponse } from "next/server";
import { askGemini } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_CHARS = 30_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
}

function getClientKey(request: NextRequest) {
  const realIp = request.headers.get("x-real-ip");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return realIp || forwarded || "unknown";
}

function allowRequest(key: string) {
  const now = Date.now();
  if (requestWindows.size > 10_000) {
    for (const [storedKey, value] of requestWindows) {
      if (value.resetAt <= now) requestWindows.delete(storedKey);
    }
    if (requestWindows.size > 10_000) requestWindows.delete(requestWindows.keys().next().value as string);
  }
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);
  if (!allowRequest(clientKey)) {
    return jsonError("تجاوزت حد الطلبات المؤقت. حاول بعد دقيقة.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("يجب إرسال جسم الطلب بصيغة JSON صحيحة.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("يجب أن يكون جسم الطلب كائن JSON.", 400);
  }

  const data = body as Record<string, unknown>;
  if (typeof data.prompt !== "string" || !data.prompt.trim()) {
    return jsonError("الحقل prompt مطلوب ويجب أن يحتوي على نص.", 400);
  }
  if (data.prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({
      success: false,
      error: "تجاوز النص الحد الأقصى المسموح وهو 30000 حرف.",
      maxLength: MAX_PROMPT_CHARS,
      receivedLength: data.prompt.length,
    }, { status: 413 });
  }
  if (data.instruction !== undefined && typeof data.instruction !== "string") {
    return jsonError("الحقل instruction يجب أن يكون نصًا.", 400);
  }
  if (data.sessionId !== undefined && typeof data.sessionId !== "string") {
    return jsonError("الحقل sessionId يجب أن يكون نصًا.", 400);
  }

  try {
    const result = await askGemini({
      prompt: data.prompt,
      instruction: typeof data.instruction === "string" ? data.instruction : undefined,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    });
    return NextResponse.json(result, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-Max-Prompt-Length": String(MAX_PROMPT_CHARS),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تنفيذ طلب Gemini.";
    console.error("[BMG Gemini API]", message);
    return NextResponse.json({ success: false, error: message }, {
      status: 502,
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
    });
  }
}
