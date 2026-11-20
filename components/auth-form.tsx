"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpLeft, Braces, LoaderCircle } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signup = mode === "signup";

  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const next = params.get("next") || "/dashboard";
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString(), queryParams: { access_type: "offline", prompt: "select_account" } },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء تسجيل الدخول باستخدام Google.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-symbol" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="30" height="30" fill="none"><path d="M11 9h26v7H19v6h15v7H19v10h-8V9Z" fill="currentColor"/><circle cx="36" cy="36" r="4" fill="currentColor"/></svg>
        </div>
        <span className="eyebrow">Nox Apis / حساب المطور</span>
        <h1>{signup ? "إنشاء حساب" : "تسجيل الدخول"}</h1>
        <p>{signup ? "أنشئ حسابك باستخدام Google لإدارة مفاتيح API ومساهماتك." : "تابع باستخدام حساب Google للوصول إلى مساحة المطور."}</p>
        <button type="button" className="google-auth-button" onClick={continueWithGoogle} disabled={busy}>
          {busy ? <LoaderCircle size={18} className="spin" /> : <svg viewBox="0 0 48 48" width="19" height="19" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>}
          <span>{busy ? "جارٍ التحويل إلى Google..." : "المتابعة باستخدام Google"}</span>
          {!busy && <ArrowUpLeft size={16} />}
        </button>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-google-note">لن نطلب منك إنشاء كلمة مرور منفصلة للموقع.</div>
        <div className="auth-switch">{signup ? "لديك حساب بالفعل؟" : "جديد على Nox Apis؟"} <Link href={signup ? "/login" : "/signup"}>{signup ? "تسجيل الدخول" : "إنشاء حساب"}</Link></div>
        <Link className="auth-back" href="/">العودة إلى المنصة</Link>
      </div>
    </div>
  );
}
