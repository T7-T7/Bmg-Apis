import { Activity, BookOpen, Boxes, CircleDashed, Code2, Database, Gauge, Radio, Timer } from "lucide-react";

const services = [
  { name: "واجهة كتالوج API", description: "استعراض النماذج والبحث والتصفية.", state: "متاح للمعاينة", ready: true, icon: Boxes },
  { name: "منشئ الواجهات", description: "إنشاء تعريف محلي ومعاينته في المتصفح.", state: "متاح للمعاينة", ready: true, icon: Code2 },
  { name: "مركز التوثيق", description: "عرض الأدلة والأمثلة التوضيحية.", state: "متاح للمعاينة", ready: true, icon: BookOpen },
  { name: "مشغّل API", description: "تنفيذ الطلبات وتوجيهها إلى الخدمات.", state: "غير مفعّل", ready: false, icon: Radio },
  { name: "قاعدة البيانات", description: "حفظ التعريفات والمستخدمين والمفاتيح.", state: "غير مفعّل", ready: false, icon: Database },
];

const futureChecks = [
  { title: "زمن الاستجابة", description: "قياس زمن تنفيذ كل نقطة اتصال.", icon: Timer },
  { title: "معدل التوفّر", description: "متابعة حالة الخدمات بصورة دورية.", icon: Activity },
  { title: "مراقبة الاستخدام", description: "إحصاء الطلبات والأخطاء والحصص.", icon: Gauge },
];

export default function StatusPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مركز المتابعة / البنية التحتية</div><h1>حالة المنصة</h1><p>نظرة شفافة على ما يعمل حاليًا وما لم يتم تفعيله بعد.</p></div></div>
      <div className="status-summary"><CircleDashed size={19} /><div><strong>المنصة في مرحلة المعاينة</strong><p>الصفحات تعمل كواجهة أمامية، بينما خدمات التشغيل والحفظ لم تُربط بعد. لا توجد قياسات مباشرة في هذه المرحلة.</p></div></div>
      <section className="page-panel">
        {services.map(service => {
          const Icon = service.icon;
          return <div className="service-row" key={service.name}><span className="service-icon"><Icon size={17} /></span><div className="service-copy"><strong>{service.name}</strong><p>{service.description}</p></div><span className={`service-state ${service.ready ? "ready" : ""}`}><i />{service.state}</span></div>;
        })}
      </section>
      <div className="section-heading"><div><span className="section-overline">المرحلة التالية</span><h2>مراقبة التشغيل</h2><p>مؤشرات سيتم تفعيلها عند توصيل الخادم وقاعدة البيانات.</p></div></div>
      <div className="docs-grid">{futureChecks.map(item => { const Icon=item.icon; return <article className="docs-card" key={item.title}><span className="docs-card-icon"><Icon size={18} /></span><h3>{item.title}</h3><p>{item.description}</p></article>; })}</div>
    </div>
  );
}