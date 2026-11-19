import Link from "next/link";
import { ArrowUpLeft, Boxes, CirclePlus, Command, Gauge, Layers3, Radio } from "lucide-react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories } from "@/lib/api-data";

const stats = [
  { label: "واجهات في الكتالوج", value: String(apiCatalog.length).padStart(2, "0"), icon: Boxes, note: "بيانات تجريبية للعرض" },
  { label: "نقاط اتصال فعّالة", value: "00", icon: Radio, note: "الخادم غير متصل" },
  { label: "التصنيفات", value: String(categories.length - 1).padStart(2, "0"), icon: Layers3, note: "تصنيفات الكتالوج" },
  { label: "حالة المنصة", value: "معاينة", icon: Gauge, note: "مرحلة الواجهة" },
];

export default function DashboardPage() {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="live-label"><span className="live-dot" /> منصة BMG للمطورين <span className="hero-label-separator">·</span> معاينة الواجهة</div>
          <h1>كل واجهات البرمجة<br /><span>في مساحة عمل واحدة.</span></h1>
          <p>اكتشف واجهات API، وتصفّح توثيقها، وجهّز تعريفات واجهاتك من لوحة موحّدة صُممت لتسهيل عمل المطورين.</p>
          <div className="hero-buttons"><Link className="primary-btn" href="/apis">استكشاف الواجهات <ArrowUpLeft size={15} /></Link><Link className="secondary-btn" href="/create">إنشاء واجهة جديدة <CirclePlus size={15} /></Link></div>
          <div className="hero-decoration"><Command size={104} strokeWidth={0.8} /></div>
        </div>
      </section>
      <section className="stats-grid">{stats.map(stat => {
        const Icon = stat.icon;
        return <div className="stat-card" key={stat.label}><div className="stat-head"><span>{stat.label}</span><span className="stat-icon"><Icon size={17} strokeWidth={1.8} /></span></div><div className="stat-value">{stat.value}</div><div className="stat-note">{stat.note}</div></div>;
      })}</section>
      <div className="section-title"><div><h2>واجهات مختارة</h2><p>نماذج من الواجهات الموجودة في الكتالوج</p></div><Link href="/apis">عرض الكتالوج <ArrowUpLeft size={13} /></Link></div>
      <div className="card-grid">{apiCatalog.slice(0, 3).map(api => <ApiCard api={api} key={api.slug} />)}</div>
      <div className="section-title"><div><h2>ابدأ مشروعك</h2><p>جهّز تعريف واجهة API باستخدام المنشئ المرئي</p></div></div>
      <div className="panel start-panel"><div className="start-panel-copy"><strong>صمّم أول واجهة API لك</strong><p>حدّد المسار وطريقة الطلب والمدخلات ونموذج الاستجابة.</p></div><Link href="/create" className="primary-btn">فتح منشئ الواجهات <ArrowUpLeft size={14} /></Link></div>
    </>
  );
}