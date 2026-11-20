"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpLeft, KeyRound, LoaderCircle, ShieldCheck, Zap } from "lucide-react";
import { motion } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function GoogleMark() {
  return <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/>
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/>
    <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/>
    <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/>
  </svg>;
}

export default function AuthForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient().auth.getSession().then(({ data }) => {
      if (!active || !data.session) return;
      const requested = params.get("next") || "/dashboard";
      const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
      window.location.replace(next);
    });
    return () => { active = false; };
  }, [params]);

  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const requested = params.get("next") || "/dashboard";
      const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString(), queryParams: { access_type: "offline" } }
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر بدء تسجيل الدخول باستخدام Google.");
      setBusy(false);
    }
  }

  return <main className="source-auth-page">
    <div className="source-auth-content">
      <Link href="/" className="source-auth-brand" aria-label="العودة إلى Bmg-Apis">
        <span className="source-auth-mark">B</span>
        <span><b>Bmg-Apis</b><small>Nexus Of Xperience</small></span>
      </Link>

      <div className="source-auth-heading">
        <span className="source-overline">DEVELOPER ACCESS / GOOGLE</span>
        <h1>مساحة المطور تبدأ من هنا.</h1>
        <p>سجّل الدخول أو أنشئ حسابك تلقائيًا باستخدام Google للوصول إلى أدوات إدارة مفاتيح API وإعدادات حسابك.</p>
      </div>

      <motion.button type="button" className="source-auth-google" onClick={continueWithGoogle} disabled={busy} whileTap={{ scale: .985 }}>
        {busy ? <LoaderCircle size={19} className="spin" /> : <GoogleMark />}
        <span>{busy ? "جارٍ التحويل إلى Google..." : "المتابعة باستخدام Google"}</span>
        {!busy && <ArrowUpLeft size={17} />}
      </motion.button>

      {error && <div className="source-auth-error" role="alert">{error}</div>}

      <div className="source-auth-explain">
        <div><span><KeyRound size={17}/></span><section><b>إدارة مفاتيح API</b><p>أنشئ مفاتيحك، تابع استخدامها، وألغِ أي مفتاح لم تعد بحاجة إليه.</p></section></div>
        <div><span><ShieldCheck size={17}/></span><section><b>حساب واحد آمن</b><p>تسجيل الدخول يتم عبر Google، ولا تحتاج إلى إنشاء كلمة مرور منفصلة داخل المنصة.</p></section></div>
        <div><span><Zap size={17}/></span><section><b>التجربة العامة لا تحتاج حسابًا</b><p>يمكنك تجربة الخدمات العامة مباشرة من Playground دون تسجيل الدخول أو مفتاح API.</p></section></div>
      </div>

      <div className="source-auth-bottom">
        <span>بالمتابعة، ستنتقل إلى Google لإكمال المصادقة.</span>
        <Link href="/">العودة إلى المنصة <ArrowUpLeft size={13}/></Link>
      </div>
    </div>
  </main>;
}
