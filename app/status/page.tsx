import { Activity, CheckCircle2, Clock3, Gauge, Radio, Server, Timer } from "lucide-react";

type ServiceStatus = { name: string; description: string; state: "جاهز للمعاينة" | "غير متصل" };

const services: ServiceStatus[] = [
  { name: "واجهة كتالوج API", description: "البحث والتصفية وبطاقات الواجهات", state: "جاهز للمعاينة" },
  { name: "منشئ الواجهات", description: "محرر تعريف الواجهة والمعاينة", state: "جاهز للمعاينة" },
  { name: "واجهة التوثيق", description: "صفحات الإرشادات والأمثلة", state: "جاهز للمعاينة" },
  { name: "مشغّل واجهات API", description: "تنفيذ نقاط الاتصال العامة", state: "غير متصل" },
];

const plannedMonitoring = [
  { title: "فحص التوفّر المباشر", icon: Activity },
  { title: "قياس زمن الاستجابة", icon: Timer },
  { title: "متابعة عدد الطلبات", icon: Gauge },
];

export default function StatusPage() {
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">مراقبة النظام</div><h1>حالة الخدمات</h1><p>تعرض هذه الصفحة حالة واجهة المنصة فقط؛ لا توجد فحوصات تشغيل أو قياسات مباشرة حتى الآن.</p></div></div>
      <div className="panel status-summary"><div className="status-summary-title"><span className="status-dot amber-dot" /><strong>واجهة المعاينة متاحة</strong></div><p>لم يتم ربط خادم خلفي أو نظام فحص التوفّر أو تحليلات الطلبات بعد.</p></div>
      <div className="panel">{services.map(service => {
        const ready = service.state === "جاهز للمعاينة";
        return <div className="status-row" key={service.name}><span className={`status-dot ${ready ? "purple-dot" : "amber-dot"}`} /><div className="status-description"><div className="status-meta">{service.name}</div><div className="status-sub">{service.description}</div></div><div className={`status-result ${ready ? "purple-text" : "amber-text"}`}>{service.state}</div></div>;
      })}</div>
      <div className="section-title"><div><h2>خطة المراقبة</h2><p>مزايا مخططة لمرحلة الخادم الخلفي</p></div></div>
      <div className="card-grid">{plannedMonitoring.map(item => {
        const Icon = item.icon;
        return <div className="panel monitoring-card" key={item.title}><span className="monitoring-icon"><Icon size={18} /></span><div>{item.title}</div><p>سيتم تفعيل هذه الميزة بعد ربط الخادم.</p></div>;
      })}</div>
    </>
  );
}