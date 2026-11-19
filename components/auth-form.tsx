"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpLeft, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const signup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (signup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده ثم سجّل الدخول.");
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
      router.replace(params.get("next") || "/dashboard/api-keys");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إكمال العملية.");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-symbol">B</div>
        <span className="eyebrow">BMG APIs / حساب المطور</span>
        <h1>{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
        <p>{signup ? "أنشئ حسابًا لإدارة مفاتيحك واقتراح واجهات API." : "سجّل الدخول للوصول إلى مفاتيح API ومساهماتك."}</p>
        <form onSubmit={submit} className="auth-form">
          {signup && <label>الاسم<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} placeholder="اسم العرض" /></label>}
          <label><span>البريد الإلكتروني</span><div className="auth-input"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" /></div></label>
          <label><span>كلمة المرور</span><div className="auth-input"><LockKeyhole size={16} /><input type="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="8 أحرف على الأقل" /></div></label>
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}
          <button className="button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : null}{signup ? "إنشاء الحساب" : "دخول"} <ArrowUpLeft size={15} /></button>
        </form>
        <div className="auth-switch">{signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <Link href={signup ? "/login" : "/signup"}>{signup ? "تسجيل الدخول" : "إنشاء حساب"}</Link></div>
        <Link className="auth-back" href="/">العودة إلى المنصة</Link>
      </div>
    </div>
  );
}
