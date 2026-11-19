"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const params = useSearchParams();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function finish() {
      const supabase = getSupabaseBrowserClient();
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("لم تكتمل جلسة Google. حاول تسجيل الدخول مرة أخرى.");
      }
      const requested = params.get("next") || "/dashboard/api-keys";
      const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard/api-keys";
      window.location.replace(next);
    }
    finish().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "تعذر إكمال تسجيل الدخول."); });
    return () => { active = false; };
  }, [params]);
  return <div className="auth-page"><div className="auth-card"><div className="auth-symbol"><LoaderCircle className="spin" /></div><h1>{error ? "تعذر تسجيل الدخول" : "جارٍ تأكيد حساب Google"}</h1><p>{error || "لحظات ويتم تحويلك إلى مساحة المطور."}</p>{error && <a className="button-primary auth-submit" href="/login">العودة لتسجيل الدخول</a>}</div></div>;
}
