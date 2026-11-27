import { NextRequest, NextResponse } from "next/server";
import { executeManagedService, isWebsiteTestRequest, managedServiceOptions } from "@/lib/server/service-manager";
import type { ExecutionContext } from "@/lib/core/engine/executor";
import { askChatGPT } from "@/lib/server/chatgpt";
import { parseApiKeyAuthorization, createDemoClientHash } from "@/lib/core/managers/auth-manager";
import { authorizeManagedServiceRequest } from "@/lib/core/managers/managed-access-manager";
import { PayloadTooLargeError, readJsonRequestBody } from "@/lib/core/managers/request-manager";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BODY_BYTES = 1_048_576;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_SESSION_CHARS = 12_000;

function jsonError(message: string, status: number) {
  const code = status === 400 ? "INVALID_REQUEST"
    : status === 401 ? "UNAUTHORIZED"
    : status === 403 ? "FORBIDDEN"
    : status === 413 ? "PAYLOAD_TOO_LARGE"
    : status === 429 ? "RATE_LIMITED"
    : status === 503 ? "SERVICE_UNAVAILABLE"
    : status === 504 ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };
  if (status === 429 || status === 503 || status === 504) headers["Retry-After"] = "30";
  return NextResponse.json({ success: false, error: message, code }, { status, headers });
}

function clientHash(request: NextRequest) {
  return createDemoClientHash(
    request,
    process.env.CHATGPT_SESSION_SECRET || process.env.GEMINI_SESSION_SECRET,
    "CHATGPT_SESSION_SECRET أو GEMINI_SESSION_SECRET غير مضبوط.",
  );
}

async function authorize(request: NextRequest, token: string | null) {
  if (!token && !isWebsiteTestRequest(request)) {
    return { ok: false as const, response: jsonError("يلزم إرسال API Key صالح للطلبات الخارجية.", 401) };
  }
  const access = await authorizeManagedServiceRequest({
    token,
    serviceSlug: "chatgpt",
    clientHash: () => clientHash(request),
    serverSecret: process.env.BMG_DEMO_RPC_SECRET,
  });
  const result = access.authorization;
  if (!result.authorized) {
    if (result.reason === "rate_limited") {
      return { ok: false as const, response: jsonError(token ? "تجاوزت حدود الاستخدام المسموح بها لحسابك أو مفتاحك." : "وصلت إلى حد التجربة المجانية.", 429) };
    }
    if (token && (result.reason === "account_suspended" || result.reason === "insufficient_scope")) {
      return { ok: false as const, response: jsonError(result.reason === "account_suspended" ? "تم إيقاف الحساب مؤقتًا. تواصل مع الإدارة." : "مفتاح API لا يملك صلاحية استخدام هذه الخدمة.", 403) };
    }
    if (result.reason === "maintenance" || result.reason === "service_unavailable") {
      return { ok: false as const, response: jsonError(result.message || "الخدمة غير متاحة مؤقتًا.", 503) };
    }
    return { ok: false as const, response: jsonError("مفتاح API غير صالح أو ملغى أو منتهي.", 401) };
  }
  return {
    ok: true as const,
    completeUsage: (options: { statusCode: number; startedAt: number; onError: (cause: unknown) => void }) => access.completeUsage(options),
  };
}

export async function OPTIONS() {
  return managedServiceOptions();
}

async function handlePost(request: NextRequest, context: ExecutionContext) {
  const authorization = request.headers.get("authorization") ?? "";
  const apiKey = parseApiKeyAuthorization(authorization);
  if (!apiKey.valid) return jsonError("صيغة ترويسة Authorization غير صحيحة.", 401);

  let body: unknown;
  try {
    body = await readJsonRequestBody(request, MAX_BODY_BYTES);
  } catch (cause) {
    if (cause instanceof PayloadTooLargeError) return jsonError("حجم الطلب يتجاوز 1 MB.", 413);
    return jsonError("يجب إرسال جسم الطلب بصيغة JSON صحيحة.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError("جسم الطلب غير صالح.", 400);
  const data = body as Record<string, unknown>;
  if (typeof data.message !== "string" || !data.message.trim()) return jsonError("الحقل message مطلوب.", 400);
  if (data.message.length > MAX_MESSAGE_CHARS) return jsonError("تجاوز message الحد الأقصى البالغ 30000 حرف.", 413);
  if (data.model !== undefined && (typeof data.model !== "string" || !["default", "auto", "gpt-4", "gpt-3.5"].includes(data.model))) {
    return jsonError("قيمة model غير مدعومة.", 400);
  }
  if (data.sessionId !== undefined && (typeof data.sessionId !== "string" || data.sessionId.length > MAX_SESSION_CHARS)) {
    return jsonError("sessionId غير صالح أو يتجاوز الحد المسموح.", 400);
  }

  const startedAt = Date.now();
  let finishUsage: ((statusCode: number) => Promise<void>) | null = null;
  try {
    const access = await authorize(request, apiKey.token);
    if (!access.ok) return access.response;
    finishUsage = (statusCode) => access.completeUsage({
      statusCode,
      startedAt,
      onError: (cause) => console.error("[Nox usage completion]", {
        requestId: context.requestId,
        error: cause instanceof Error ? cause.message : cause,
      }),
    });

    const result = await askChatGPT({
      message: data.message,
      model: typeof data.model === "string" ? data.model : "default",
      sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
    });
    await finishUsage(200);
    return NextResponse.json({
      ...result,
      access: apiKey.token ? "api_key" : "demo",
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-Max-Message-Length": String(MAX_MESSAGE_CHARS),
      },
    });
  } catch (cause) {
    if (finishUsage) await finishUsage(502);
    const message = cause instanceof Error ? cause.message : "Unknown ChatGPT error";
    const timeout = /timed out|timeout|aborted/i.test(message);
    console.error("[Nox ChatGPT API]", {
      requestId: context.requestId,
      errorName: cause instanceof Error ? cause.name : "UnknownError",
      error: message.slice(0, 240),
    });
    return jsonError(timeout ? "انتهت مهلة انتظار ChatGPT بعد 300 ثانية." : "تعذر الحصول على رد من ChatGPT حاليًا.", timeout ? 504 : 502);
  }
}

export async function POST(request: NextRequest) {
  return executeManagedService("chatgpt", request, (context) => handlePost(request, context));
}
