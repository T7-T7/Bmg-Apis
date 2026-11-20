"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowUpLeft, ArrowUpRight, BarChart3, CheckCircle2, Clock3, Code2, KeyRound, LogOut, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import ApiKeyManager from "@/components/api-key-manager";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = { name: string; email: string; avatar: string };

const reveal = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: .48, ease: "easeOut" as const } } };

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [keyCount, setKeyCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !data.user) {
        router.replace("/login?next=/dashboard");
        setChecking(false);
        return;
      }
      const user = data.user;
      const metadata = user.user_metadata ?? {};
      setProfile({
        name: String(metadata.full_name || metadata.name || user.email?.split("@")[0] || "Developer"),
        email: user.email ?? "",
        avatar: String(metadata.avatar_url || metadata.picture || ""),
      });
      const { data: keys, error: keyError } = await supabase.rpc("bmg_list_api_keys");
      if (!active) return;
      if (keyError) setError("تعذر تحميل عدد المفاتيح حاليًا.");
      else setKeyCount(Array.isArray(keys) ? keys.length : 0);
      setChecking(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (checking) return <div className="dashboard-loading"><div className="skeleton dashboard-skeleton" /><div className="skeleton dashboard-skeleton" /><div className="skeleton dashboard-skeleton" /></div>;
  if (!profile) return null;

  return (
    <div className="nox-dashboard">
      <motion.section className="dashboard-welcome glass-panel" variants={reveal} initial="hidden" animate="visible">
        <div className="dashboard-welcome-copy">
          <span className="eyebrow"><Sparkles size={14} /> NOX DEVELOPER SPACE</span>
          <h1>مرحبًا، {profile.name}</h1>
          <p>مساحة التحكم في مفاتيحك وخدماتك وطلبات API.</p>
          <div className="dashboard-welcome-actions">
            <Link href="/playground" className="button-primary"><Zap size={15} /> جرّب Playground <ArrowUpLeft size={14} /></Link>
            <Link href="/apis" className="button-secondary">استكشف الكتالوج <ArrowUpLeft size={14} /></Link>
          </div>
        </div>
        <div className="dashboard-profile">
          {profile.avatar ? <img src={profile.avatar} alt="" width={64} height={64} referrerPolicy="no-referrer" /> : <span>{profile.name.slice(0, 1).toUpperCase()}</span>}
          <strong>{profile.name}</strong>
          <small>{profile.email}</small>
          <span className="profile-verified"><CheckCircle2 size={13} /> حساب Google</span>
        </div>
        <div className="dashboard-welcome-orbit" aria-hidden="true" />
      </motion.section>

      <motion.section className="dashboard-stats" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .15 }}>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><Activity size={18} /></span><div><small>إجمالي الطلبات</small><strong>—</strong><em>سجل الاستخدام غير متصل بعد</em></div></article>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><Code2 size={18} /></span><div><small>واجهات متصلة</small><strong>2</strong><em>Gemini وأسعار العملات</em></div></article>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><KeyRound size={18} /></span><div><small>مفاتيح API</small><strong>{keyCount}</strong><em>عدد فعلي من حسابك</em></div></article>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><BarChart3 size={18} /></span><div><small>حد الطلبات</small><strong>30 <i>/ min</i></strong><em>لكل مفتاح نشط حسب سياسة الخدمة</em></div></article>
      </motion.section>

      <motion.section className="dashboard-section" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="section-heading"><div><span className="section-overline">ACCESS CONTROL</span><h2>مفاتيح الوصول</h2><p>أنشئ مفتاحًا جديدًا أو ألغِ مفتاحًا قديمًا. لن تظهر قيمة المفتاح مرة أخرى بعد إغلاقها.</p></div><span className="dashboard-section-badge"><ShieldCheck size={14} /> محمية</span></div>
        <div className="dashboard-key-card glass-panel"><ApiKeyManager /></div>
      </motion.section>

      <motion.section className="dashboard-section" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="section-heading"><div><span className="section-overline">REQUEST LOG</span><h2>سجل الطلبات</h2><p>لا نعرض أرقامًا أو طلبات افتراضية على أنها نشاط حقيقي.</p></div></div>
        <div className="dashboard-table-wrap glass-panel">
          <div className="workspace-empty"><span className="workspace-empty-icon"><Activity size={25} /></span><h2>سجل الاستخدام غير مفعّل بعد</h2><p>سيظهر هنا سجل الطلبات الفعلي بعد توصيل خدمة التسجيل وواجهة القراءة الآمنة.</p></div>
        </div>
      </motion.section>

      {error && <p className="dashboard-error">{error}</p>}
      <div className="dashboard-bottom-actions"><Link href="/docs" className="text-link">اقرأ التوثيق <ArrowUpRight size={14} /></Link><motion.button className="button-secondary" onClick={logout} whileTap={{ scale: .97 }}><LogOut size={15} /> تسجيل الخروج</motion.button></div>
    </div>
  );
}
