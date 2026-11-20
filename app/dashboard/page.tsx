"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowUpLeft, ArrowUpRight, BarChart3, CheckCircle2, Clock3, Code2, KeyRound, LogOut, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import ApiKeyManager from "@/components/api-key-manager";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = { name: string; email: string; avatar: string };

const sampleRequests = [
  { id: "req_8F21", endpoint: "/api/v1/ai/gemini", method: "POST", status: 200, time: "قبل دقيقتين", duration: "1.24s" },
  { id: "req_8F20", endpoint: "/api/v1/ai/gemini", method: "POST", status: 200, time: "قبل 18 دقيقة", duration: "980ms" },
  { id: "req_8F19", endpoint: "/api/v1/currency/rate", method: "GET", status: 200, time: "قبل ساعة", duration: "142ms" },
  { id: "req_8F18", endpoint: "/api/v1/ai/image", method: "POST", status: 202, time: "أمس", duration: "—" },
];

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
          {profile.avatar ? <Image src={profile.avatar} alt="" width={64} height={64} unoptimized /> : <span>{profile.name.slice(0, 1).toUpperCase()}</span>}
          <strong>{profile.name}</strong>
          <small>{profile.email}</small>
          <span className="profile-verified"><CheckCircle2 size={13} /> حساب Google</span>
        </div>
        <div className="dashboard-welcome-orbit" aria-hidden="true" />
      </motion.section>

      <motion.section className="dashboard-stats" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .15 }}>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><Activity size={18} /></span><div><small>إجمالي الطلبات</small><strong>1,284</strong><em>بيانات عرض تجريبية</em></div></article>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><Code2 size={18} /></span><div><small>واجهات مستخدمة</small><strong>1</strong><em>Gemini متصلة حاليًا</em></div></article>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><KeyRound size={18} /></span><div><small>مفاتيح API</small><strong>{keyCount}</strong><em>عدد فعلي من حسابك</em></div></article>
        <article className="dashboard-stat glass-panel"><span className="dashboard-stat-icon"><BarChart3 size={18} /></span><div><small>حد الاستخدام</small><strong>30 <i>/ min</i></strong><em>لكل مفتاح نشط</em></div></article>
      </motion.section>

      <motion.section className="dashboard-section" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="section-heading"><div><span className="section-overline">ACCESS CONTROL</span><h2>مفاتيح الوصول</h2><p>أنشئ مفتاحًا جديدًا أو ألغِ مفتاحًا قديمًا. لن تظهر قيمة المفتاح مرة أخرى بعد إغلاقها.</p></div><span className="dashboard-section-badge"><ShieldCheck size={14} /> محمية</span></div>
        <div className="dashboard-key-card glass-panel"><ApiKeyManager /></div>
      </motion.section>

      <motion.section className="dashboard-section" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="section-heading"><div><span className="section-overline">REQUEST LOG</span><h2>آخر الطلبات</h2><p>صفوف توضيحية لتصميم سجل الطلبات؛ ليست سجلًا حيًا من قاعدة البيانات.</p></div><span className="sample-data-label"><Clock3 size={13} /> Sample data</span></div>
        <div className="dashboard-table-wrap glass-panel">
          <table className="dashboard-table">
            <thead><tr><th>المعرّف</th><th>نقطة الاتصال</th><th>الطريقة</th><th>الحالة</th><th>الزمن</th><th>التوقيت</th></tr></thead>
            <tbody>{sampleRequests.map(item => <tr key={item.id}><td><code>{item.id}</code></td><td><code dir="ltr">{item.endpoint}</code></td><td><span className="dashboard-method">{item.method}</span></td><td><span className="dashboard-http"><i />{item.status}</span></td><td>{item.duration}</td><td>{item.time}</td></tr>)}</tbody>
          </table>
          <div className="dashboard-table-note">سيظهر السجل الفعلي بعد ربط واجهة قراءة آمنة ببيانات الاستخدام.</div>
        </div>
      </motion.section>

      {error && <p className="dashboard-error">{error}</p>}
      <div className="dashboard-bottom-actions"><Link href="/docs" className="text-link">اقرأ التوثيق <ArrowUpRight size={14} /></Link><motion.button className="button-secondary" onClick={logout} whileTap={{ scale: .97 }}><LogOut size={15} /> تسجيل الخروج</motion.button></div>
    </div>
  );
}
