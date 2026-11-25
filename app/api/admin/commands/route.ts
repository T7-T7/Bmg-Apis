import { NextResponse } from "next/server";
import { executeAdminCommand } from "@/lib/core/commands/command-executor";
import { createAdminCommandRuntime } from "@/lib/core/commands/admin-command-runtime";
import { AdminCommandError } from "@/lib/core/commands/command-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, error: "حجم الطلب أكبر من الحد المسموح." }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "حجم الطلب أكبر من الحد المسموح." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, error: "جسم الطلب يجب أن يكون JSON صالحاً." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: "بيانات الطلب غير صالحة." }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.command !== "string" || !payload.command.trim()) {
    return NextResponse.json({ success: false, error: "اسم الأمر مطلوب." }, { status: 400 });
  }

  try {
    const dependencies = await createAdminCommandRuntime();
    const result = await executeAdminCommand({
      request, command: payload.command, input: payload.input,
    }, dependencies);
    return NextResponse.json({ success: true, ...result }, {
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    if (error instanceof AdminCommandError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, {
        status: error.status, headers: { "Cache-Control": "no-store" },
      });
    }
    const message = error instanceof Error ? error.message : "تعذر تنفيذ الأمر الإداري.";
    const status = message.includes("يلزم تسجيل الدخول") ? 401 : 400;
    return NextResponse.json({ success: false, error: message }, {
      status, headers: { "Cache-Control": "no-store" },
    });
  }
}
