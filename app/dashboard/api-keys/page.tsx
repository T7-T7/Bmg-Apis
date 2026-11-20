"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import ApiKeyManager from "@/components/api-key-manager";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ApiKeysPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  useEffect(() => {
    let active = true;
    getSupabaseBrowserClient().auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) router.replace("/login?next=/dashboard/api-keys");
      else setEmail(data.user.email ?? "");
      setChecking(false);
    });
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/"); router.refresh();
  }

  if (checking) return <div className="workspace-empty">جارٍ التحقق من الحساب...</div>;
  if (!email) return null;

  return <div className="keys-page">
    <div className="page-heading"><div><div className="eyebrow">مساحة المطور / بيانات الوصول</div><h1>مفاتيح API</h1><p>أنشئ مفاتيح سرية، وتابع استخدامها، وألغِ أي مفتاح لم تعد تحتاجه.</p></div><button className="button-quiet" onClick={logout}><LogOut size={15} /> تسجيل الخروج</button></div>
    <div className="account-strip"><span className="account-avatar">{email.slice(0,1).toUpperCase()}</span><div><strong>{email}</strong><small>حساب Nox Apis</small></div><Link href="/my-apis">مساهماتي</Link></div>
    <section className="key-panel"><div className="key-panel-heading"><span><KeyRound size={18} /></span><div><h2>إدارة مفاتيح الوصول</h2><p>كل مفتاح مرتبط بحسابك ويمكن إلغاؤه بشكل مستقل.</p></div></div><ApiKeyManager /></section>
    <div className="docs-note"><ShieldCheck size={14} /> لا تشارك المفتاح في المستودعات العامة أو تطبيقات المتصفح. استخدمه من الخادم عبر ترويسة Authorization: Bearer.</div>
  </div>;
}
