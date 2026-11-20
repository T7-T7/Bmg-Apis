import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 15;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status, headers: CORS_HEADERS });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\\s+((?:nox_live_|bmg_live_)[A-Za-z0-9_-]+)$/i)?.[1];
  if (!token) return jsonError("مفتاح Nox API مطلوب في ترويسة Authorization: Bearer.", 401);

  const base = (request.nextUrl.searchParams.get("base") || "USD").trim().toUpperCase();
  const target = (request.nextUrl.searchParams.get("target") || "EUR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(target)) {
    return jsonError("رمزا العملتين يجب أن يتكونا من ثلاثة أحرف، مثل USD وEUR.", 400);
  }

  try {
    const { data: access, error } = await getSupabase().rpc("bmg_authorize_api_request", {
      p_key: token,
      p_service_slug: "currency-rate",
      p_method: "GET",
    });
    if (error) {
      console.error("[Nox currency key validation]", error.message);
      return jsonError("تعذر التحقق من مفتاح API حاليًا.", 503);
    }
    const result = access as { authorized?: boolean; reason?: string } | null;
    if (!result?.authorized) {
      if (result?.reason === "rate_limited") return jsonError("تجاوزت حد 30 طلبًا في الدقيقة لهذا المفتاح.", 429);
      if (result?.reason === "service_unavailable") return jsonError("الخدمة غير متاحة حاليًا.", 503);
      return jsonError("مفتاح API غير صحيح أو ملغى أو منتهي الصلاحية.", 401);
    }

    if (base === target) {
      return NextResponse.json({
        success: true,
        base,
        target,
        rate: 1,
        date: null,
        source: "Frankfurter",
        rateType: "daily_reference",
      }, { headers: CORS_HEADERS });
    }

    const upstream = await fetch(
      `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base.toLowerCase())}/${encodeURIComponent(target.toLowerCase())}`,
      { signal: AbortSignal.timeout(8_000), next: { revalidate: 3600 } },
    );

    if (upstream.status === 404 || upstream.status === 422 || upstream.status === 400) {
      return jsonError("رمز العملة غير مدعوم أو لا يتوفر له سعر مرجعي.", 422);
    }
    if (!upstream.ok) {
      console.error("[Nox currency provider]", "Frankfurter returned", upstream.status);
      return jsonError("مصدر أسعار العملات غير متاح مؤقتًا.", 502);
    }

    const data: unknown = await upstream.json();
    if (!data || typeof data !== "object") return jsonError("أعاد مصدر أسعار العملات استجابة غير صالحة.", 502);
    const rateData = data as { base?: unknown; quote?: unknown; rate?: unknown; date?: unknown };
    if (typeof rateData.rate !== "number" || !Number.isFinite(rateData.rate) || rateData.rate <= 0) {
      return jsonError("لم يتوفر سعر صالح لزوج العملات المطلوب.", 502);
    }

    return NextResponse.json({
      success: true,
      base,
      target,
      rate: rateData.rate,
      date: typeof rateData.date === "string" ? rateData.date : null,
      source: "Frankfurter",
      rateType: "daily_reference",
      note: "أسعار مرجعية يومية وليست أسعار تداول لحظية.",
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[Nox currency API]", error instanceof Error ? error.message : error);
    return jsonError("تعذر جلب سعر العملة حاليًا. حاول مرة أخرى لاحقًا.", 502);
  }
}
