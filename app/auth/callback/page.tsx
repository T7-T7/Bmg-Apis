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
      const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (oauthError) {
        throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
      }

      const supabase = getSupabaseBrowserClient();
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          throw new Error("وصلنا إلى صفحة العودة من Google بدون رمز تسجيل أو جلسة محفوظة. ابدأ تسجيل الدخول من جديد.");
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
