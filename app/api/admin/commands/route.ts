import { NextResponse } from "next/server";
import { executeAdminCommand } from "@/lib/core/commands/command-executor";
import { createAdminCommandRuntime } from "@/lib/core/commands/admin-command-runtime";
import { AdminCommandError, AdminCommandInputError } from "@/lib/core/commands/command-types";
import { PayloadTooLargeError, readJsonRequestBody } from "@/lib/core/managers/request-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await readJsonRequestBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ success: false, error: "حجم الطلب أكبر من الحد المسموح." }, { status: 413 });
    }
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
    if (error instanceof AdminCommandInputError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, {
        status: error.status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    if (error instanceof AdminCommandError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, {
        status: error.status, headers: { "Cache-Control": "no-store" },
      });
    }
    console.error("[Nox Admin Command]", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, code: "INTERNAL_ERROR", error: "حدث خطأ داخلي أثناء تنفيذ الأمر الإداري." }, {
      status: 500, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
}
