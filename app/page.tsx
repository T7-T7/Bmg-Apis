import Link from "next/link";
import { Activity, ArrowUpLeft, Boxes, Code2, Command, Radio, ShieldCheck, Terminal, Users } from "lucide-react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories } from "@/lib/api-data";

const stats = [
  { label: "واجهات في الكتالوج", value: String(apiCatalog.length).padStart(2, "0"), detail: "نماذج معروضة", icon: Boxes },
  { label: "التصنيفات", value: String(categories.length - 1).padStart(2, "0"), detail: "مجالات الخدمة", icon: Code2 },
  { label: "خدمات متصلة فعليًا", value: "00", detail: "قيد التجهيز", icon: Radio },
];

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div className="welcome-grid" />
        <div className="welcome-content">
          <div className="welcome-kicker"><span className="kicker-pulse" /> منصة واجهات البرمجة <span className="kicker-divider">/</span> BMG APIs</div>
          <h1>واجهات جاهزة.<br /><span>تكامل أسرع.</span></h1>
          <p>استخدم واجهات API التي توفرها BMG، واكتشف مساهمات المطورين بعد مراجعتها واعتمادها.</p>
          <div className="welcome-actions">
            <Link href="/apis" className="button-primary">استكشف واجهات API <ArrowUpLeft size={16} /></Link>
            <Link href="/create" className="button-quiet"><Users size={16} /> اقترح واجهة للمجتمع</Link>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="orbit-core"><Terminal size={48} strokeWidth={1.3} /></div>
          <span className="orbit-chip chip-one"><Code2 size={15} /> REST</span>
          <span className="orbit-chip chip-two"><ShieldCheck size={15} /> REVIEW</span>
          <span className="orbit-chip chip-three"><Activity size={15} /> STATUS</span>
        </div>
        <div className="welcome-bottom"><span><Command size={13} /> واجهات للاستخدام المباشر</span><span>إصدار المعاينة <b>0.4</b></span></div>
      </section>

      <section className="overview-stats" aria-label="إحصائيات المنصة">
        {stats.map(stat => { const Icon = stat.icon; return <article className="overview-stat" key={stat.label}><span className="stat-icon"><Icon size={18} /></span><div className="stat-copy"><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></div></article>; })}
      </section>

      <div className="section-heading">
        <div><span className="section-overline">كتالوج المنصة</span><h2>واجهات API المتاحة</h2><p>نماذج الكتالوج الحالية للتجربة والتطوير التدريجي.</p></div>
        <Link href="/apis" className="text-link">عرض الكتالوج <ArrowUpLeft size={15} /></Link>
      </div>
      <div className="api-grid">{apiCatalog.slice(0, 3).map(api => <ApiCard key={api.slug} api={api} />)}</div>

      <section className="workflow-section">
        <div className="section-heading"><div><span className="section-overline">مساهمة المجتمع</span><h2>كيف تُنشر واجهة المطور؟</h2><p>لا تظهر أي مساهمة للعامة قبل مراجعتها.</p></div></div>
        <div className="workflow-grid">
          <article className="workflow-card"><div className="workflow-card-top"><span>01</span><Users size={19} /></div><h3>إرسال المساهمة</h3><p>أرسل بيانات API ورابطها وكود اختبارها.</p></article>
          <article className="workflow-card"><div className="workflow-card-top"><span>02</span><ShieldCheck size={19} /></div><h3>مراجعة المشرف</h3><p>تُفحص البيانات وكود الاختبار قبل الموافقة.</p></article>
          <article className="workflow-card"><div className="workflow-card-top"><span>03</span><Activity size={19} /></div><h3>مراقبة الحالة</h3><p>تُراقب الخدمة دوريًا وتُعرض حالة توفرها.</p></article>
        </div>
      </section>

      <section className="bottom-cta"><div className="cta-icon"><Users size={21} /></div><div><strong>لديك واجهة API مفيدة؟</strong><p>اقترحها على المجتمع لتدخل مرحلة المراجعة.</p></div><Link href="/create" className="button-primary">إرسال مساهمة <ArrowUpLeft size={15} /></Link></section>
    </div>
  );
}