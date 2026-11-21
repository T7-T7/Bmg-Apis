import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const path = request.nextUrl.pathname;
  const protectedRoute = path === "/playground" || path === "/dashboard" || path.startsWith("/dashboard/");
  const authRoute = path === "/login" || path === "/signup";

  if (!url || !key) {
    if (protectedRoute) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (protectedRoute) response.headers.set("Cache-Control", "private, no-store, max-age=0");

  if (protectedRoute && !claims) {
    const destination = new URL("/login", request.url);
    return copyCookies(response, NextResponse.redirect(destination));
  }

  if (authRoute && claims) {
    return copyCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  return response;
}

function copyCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach(cookie => destination.cookies.set(cookie));
  source.headers.forEach((value, name) => {
    if (name.toLowerCase() === "cache-control" || name.toLowerCase() === "expires" || name.toLowerCase() === "pragma") {
      destination.headers.set(name, value);
    }
  });
  return destination;
}

export const config = {
  matcher: [
    "/playground",
    "/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
