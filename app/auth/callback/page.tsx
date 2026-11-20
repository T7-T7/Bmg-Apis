"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function finish() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
      const queryError = url.searchParams.get("error_description") || url.searchParams.get("error");
      const fragmentError = fragment.get("error_description") || fragment.get("error");
      const code = url.searchParams.get("code");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

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
        const { data, error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("لم يتمكن Supabase من إنشاء جلسة تسجيل الدخول.");
      } else {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("لم يصل رمز تسجيل الدخول من Google. ابدأ تسجيل الدخول من جديد.");
      }

      const requested = url.searchParams.get("next") || "/dashboard";
      const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
      window.location.replace(next);
    }

    finish().catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "تعذر إكمال تسجيل الدخول باستخدام Google.");
    });
    return () => { active = false; };
  }, []);

  return <main className="source-auth-page">
    <div className="source-auth-progress">
      <span className="source-auth-mark">B</span>
      {error ? <AlertCircle size={22}/> : <LoaderCircle size={22} className="spin"/>}
      <h1>{error ? "تعذر إكمال تسجيل الدخول" : "جارٍ تأكيد حساب Google"}</h1>
      <p>{error || "تم استلام طلب المصادقة. نتحقق من الجلسة ثم نعيدك إلى المنصة."}</p>
      {error && <Link href="/login" className="source-auth-retry">العودة لتسجيل الدخول</Link>}
    </div>
  </main>;
}
