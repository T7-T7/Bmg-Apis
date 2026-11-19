"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function finish() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
      const queryError =
        url.searchParams.get("error_description") ||
        url.searchParams.get("error");
      const fragmentError =
        fragment.get("error_description") ||
        fragment.get("error");

      const code = url.searchParams.get("code");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      // Remove OAuth credentials from the visible URL and browser history immediately.
      const cleanUrl = new URL(url);
      cleanUrl.hash = "";
      cleanUrl.searchParams.delete("code");
      cleanUrl.searchParams.delete("error");
      cleanUrl.searchParams.delete("error_description");
      window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

      const oauthError = queryError || fragmentError;
      if (oauthError) throw new Error(oauthError);

      const supabase = getSupabaseBrowserClient();

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else if (accessToken && refreshToken) {
        // Backward compatibility for Supabase's implicit-flow callback URLs.
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("لم يتمكن Supabase من إنشاء جلسة تسجيل الدخول.");
      } else {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error("لم يصل رمز تسجيل الدخول من Google. ابدأ تسجيل الدخول من جديد.");
        }
      }

      const requested = url.searchParams.get("next") || "/dashboard/api-keys";
      const next = requested.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/dashboard/api-keys";

      window.location.replace(next);
    }

    finish().catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "تعذر إكمال تسجيل الدخول باستخدام Google.");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-symbol"><LoaderCircle className="spin" /></div>
        <h1>{error ? "تعذر تسجيل الدخول" : "جارٍ تأكيد حساب Google"}</h1>
        <p>{error || "لحظات ويتم تحويلك إلى مساحة المطور."}</p>
        {error && <a className="button-primary auth-submit" href="/login">العودة لتسجيل الدخول</a>}
      </div>
    </div>
  );
}
