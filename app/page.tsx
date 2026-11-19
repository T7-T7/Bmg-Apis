import Link from "next/link";
import {
  Activity, ArrowLeft, ArrowUpLeft, ArrowUpRight, Boxes, Braces,
  CirclePlus, Code2, Command, Layers3, Radio, Sparkles, Terminal,
} from "lucide-react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories } from "@/lib/api-data";

const stats = [
  { label: "واجهات في الكتالوج", value: String(apiCatalog.length).padStart(2, "0"), detail: "نماذج أولية", icon: Boxes },
  { label: "التصنيفات", value: String(categories.length - 1).padStart(2, "0"), detail: "مجالات مختلفة", icon: Layers3 },
  { label: "نقاط اتصال مباشرة", value: "00", detail: "لم تُفعّل بعد", icon: Radio },
];

const steps = [
  { number: "01", title: "استكشف", text: "اعثر على الواجهة المناسبة لمشروعك.", icon: Boxes },
  { number: "02", title: "جهّز", text: "أنشئ تعريفًا وحدد المسار والمدخلات.", icon: Braces },
  { number: "03", title: "تكامل", text: "اختبر الطلب وجهّز التوثيق والنشر.", icon: Terminal },
];

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div className="welcome-grid" />
        <div className="welcome-content">
          <div className="welcome-kicker"><span className="kicker-pulse" /> بوابة المطورين <span className="kicker-divider">/</span> BMG APIs</div>
          <h1>ابنِ. اربط. <span>انطلق.</span></h1>
          <p>كل ما تحتاجه لاكتشاف واجهات البرمجة وإدارتها وتجهيزها، في مساحة عمل واحدة مصممة للمطورين.</p>
          <div className="welcome-actions">
            <Link href="/apis" className="button-primary">استكشف الواجهات <ArrowUpLeft size={16} /></Link>
            <Link href="/create" className="button-quiet"><CirclePlus size={16} /> أنشئ واجهتك</Link>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="orbit-core"><Braces size={54} strokeWidth={1.2} /></div>
          <span className="orbit-chip chip-one"><Code2 size={15} /> API</span>
          <span className="orbit-chip chip-two"><Terminal size={15} /> REST</span>
          <span className="orbit-chip chip-three"><Sparkles size={15} /> DEV</span>
        </div>
        <div className="welcome-bottom"><span><Command size={13} /> منصة موحدة للمطورين</span><span>إصدار المعاينة <b>0.3</b></span></div>
      </section>

      <section className="overview-stats" aria-label="إحصائيات المنصة">
        {stats.map(stat => {
          const Icon = stat.icon;
          return <article className="overview-stat" key={stat.label}><span className="stat-icon"><Icon size={18} /></span><div className="stat-copy"><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></div><span className="stat-trend"><ArrowUpRight size={14} /></span></article>;
        })}
      </section>

      <div className="section-heading">
        <div><span className="section-overline">اكتشف الإمكانيات</span><h2>واجهات تستحق التجربة</h2><p>مجموعة من النماذج الأولية للتعرّف على طريقة عمل المنصة.</p></div>
        <Link href="/apis" className="text-link">عرض جميع الواجهات <ArrowUpLeft size={15} /></Link>
      </div>
      <div className="api-grid">{apiCatalog.slice(0, 3).map(api => <ApiCard key={api.slug} api={api} />)}</div>

      <section className="workflow-section">
        <div className="section-heading"><div><span className="section-overline">سير العمل</span><h2>من الفكرة إلى نقطة الاتصال</h2><p>خطوات واضحة لتنظيم واجهاتك قبل تشغيلها.</p></div><Link href="/docs" className="text-link">دليل المطور <ArrowUpLeft size={15} /></Link></div>
        <div className="workflow-grid">{steps.map((step, index) => {
          const Icon = step.icon;
          return <article className="workflow-card" key={step.number}><div className="workflow-card-top"><span>{step.number}</span><Icon size={19} /></div><h3>{step.title}</h3><p>{step.text}</p>{index < steps.length - 1 && <span className="workflow-connector"><ArrowLeft size={15} /></span>}</article>;
        })}</div>
      </section>

      <section className="bottom-cta"><div className="cta-icon"><Activity size={21} /></div><div><strong>جاهز لبدء واجهتك الأولى؟</strong><p>ابدأ بتعريف نقطة الاتصال، ثم أكمل إعدادها من مساحة المطور.</p></div><Link href="/create" className="button-primary">فتح المنشئ <ArrowUpLeft size={15} /></Link></section>
    </div>
  );
}