import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { success: false, status: "not_ready", checks: { database: "not_configured" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const response = await fetch(
      new URL("/rest/v1/api_services?select=slug&limit=1", url),
      {
        method: "GET",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(4_000)
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, status: "not_ready", checks: { database: "unavailable" } },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: { application: "ok", database: "ok" }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, status: "not_ready", checks: { database: "unreachable" } },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
