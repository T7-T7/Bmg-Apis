import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "تعذر التحقق من الجلسة أو إعدادات التحليلات." }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "انتهت الجلسة. سجّل الدخول مجددًا." }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.schema("private").from("api_usage")
    .select("id,service_slug,request_method,status_code,latency_ms,created_at")
    .eq("user_id", authData.user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: "تعذر تحميل سجل الاستخدام." }, { status: 503 });
  }

  const rows = data ?? [];
  const successful = rows.filter((row) => row.status_code !== null && row.status_code >= 200 && row.status_code < 400).length;
  const measured = rows.filter((row) => typeof row.latency_ms === "number");
  const avgLatency = measured.length ? Math.round(measured.reduce((sum, row) => sum + (row.latency_ms ?? 0), 0) / measured.length) : null;
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: rows.filter((row) => row.created_at.slice(0, 10) === key).length };
  });
  const serviceMap = new Map<string, number>();
  for (const row of rows) serviceMap.set(row.service_slug, (serviceMap.get(row.service_slug) ?? 0) + 1);

  return NextResponse.json({
    range: "30d",
    totals: {
      requests: rows.length,
      successRate: rows.length ? Math.round((successful / rows.length) * 100) : null,
      avgLatency,
      measuredRequests: measured.length,
    },
    daily,
    services: [...serviceMap.entries()].map(([slug, count]) => ({ slug, count })).sort((a, b) => b.count - a.count),
    recent: rows.slice(0, 12).map((row) => ({
      id: row.id,
      service: row.service_slug,
      method: row.request_method,
      status: row.status_code,
      latency: row.latency_ms,
      createdAt: row.created_at,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
