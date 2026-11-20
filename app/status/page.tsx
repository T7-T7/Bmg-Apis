import { Activity, BookOpen, Boxes, CircleDashed, Database, Gauge, Radio, ShieldCheck, Timer, Users } from "lucide-react";

const services = [
  { name: "عقل — Gemini API", description: "واجهة محادثة فعلية بحد 30 ألف حرف للطلب.", state: "متاحة", ready: true, icon: Radio },\n  { name: "أسعار العملات", description: "سعر صرف مرجعي يومي عبر Frankfurter مع مفتاح Nox API.", state: "متاحة", ready: true, icon: Gauge },
  { name: "كتالوج واجهات API", description: "استعراض الخدمات والبحث والتصفية.", state: "واجهة جاهزة", ready: true, icon: Boxes },
  { name: "التوثيق", description: "شرح الاستخدام وأمثلة الطلبات.", state: "واجهة جاهزة", ready: true, icon: BookOpen },
  { name: "مراجعة مساهمات المجتمع", description: "حفظ المقترحات ومراجعتها قبل اعتمادها.", state: "متاحة", ready: true, icon: ShieldCheck },
  { name: "تشغيل واجهات المجتمع", description: "تشغيل كود الواجهات التي يرسلها المستخدمون داخل بيئة معزولة.", state: "غير مفعّل", ready: false, icon: Radio },
  { name: "قاعدة البيانات والحسابات", description: "Supabase للمصادقة ومفاتيح API والمساهمات وسجل الاستخدام.", state: "متاحة", ready: true, icon: Database },
  { name: "مراقبة الخدمات", description: "الفحص الدوري والتنبيهات وسجل الأعطال لم تُفعّل بعد.", state: "غير مفعّلة", ready: false, icon: Activity },
];

const checks = [
  { title: "زمن الاستجابة", description: "قياس زمن تنفيذ كل نقطة اتصال.", icon: Timer },
  { title: "معدل التوفّر", description: "متابعة نجاح الفحوصات عبر الزمن.", icon: Gauge },
  { title: "مساهمات المجتمع", description: "مراجعة بشرية ثم اختبار آمن قبل النشر.", icon: Users },
];

export default function StatusPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مركز المتابعة / البنية التحتية</div><h1>حالة المنصة</h1><p>الحالة الفعلية لمكونات المشروع، دون عرض قياسات غير متصلة بمراقبة حقيقية.</p></div></div>
      <div className="status-summary"><CircleDashed size={19} /><div><strong>المنصة في مرحلة بناء الخدمات</strong><p>الواجهة الأمامية منشورة، لكن تشغيل APIs والمراجعة والحسابات والمراقبة الدورية لم تُفعّل بعد. لا توجد بيانات توفر أو زمن استجابة حقيقية حاليًا.</p></div></div>
      <section className="page-panel">{services.map(service => { const Icon = service.icon; return <div className="service-row" key={service.name}><span className="service-icon"><Icon size={17} /></span><div className="service-copy"><strong>{service.name}</strong><p>{service.description}</p></div><span className={`service-state ${service.ready ? "ready" : ""}`}><i />{service.state}</span></div>; })}</section>
      <div className="section-heading"><div><span className="section-overline">مؤشرات المراقبة المطلوبة</span><h2>متابعة كل خدمة</h2><p>سيتم عرض هذه المؤشرات بعد بناء نظام الفحص والجدولة.</p></div></div>
      <div className="docs-grid">{checks.map(item => { const Icon = item.icon; return <article className="docs-card" key={item.title}><span className="docs-card-icon"><Icon size={18} /></span><h3>{item.title}</h3><p>{item.description}</p></article>; })}</div>
    </div>
  );
}