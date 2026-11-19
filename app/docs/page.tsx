import Link from "next/link";
import { ArrowUpLeft, Braces, BookOpen, Code2, Layers3, ShieldCheck } from "lucide-react";

const guides = [
  { title: "البداية السريعة", description: "تعرّف على الكتالوج وافتح تفاصيل الواجهة وطريقة قراءة المسارات.", href: "/apis", icon: Code2 },
  { title: "إنشاء واجهة", description: "جهّز اسم الواجهة ومعرّفها وطريقة الطلب ومسار نقطة الاتصال.", href: "/create", icon: Braces },
  { title: "إدارة الواجهات", description: "افهم دورة حياة الواجهة من التعريف إلى الاختبار والنشر.", href: "/my-apis", icon: Layers3 },
];

const requestExample = `const response = await fetch(
  "https://api.example.com/api/v1/echo?message=hello",
  { method: "GET" }
);

const result = await response.json();
console.log(result);`;

const responseExample = `{
  "status": "preview",
  "data": {
    "message": "hello"
  },
  "requestId": "demo-request"
}`;

export default function DocsPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مركز المعرفة / المطورون</div><h1>مركز التوثيق</h1><p>مرجع مبسط لفهم مكونات المنصة، والتعامل مع مسارات API، وقراءة أمثلة الطلب والاستجابة.</p></div></div>
      <div className="docs-grid">{guides.map(guide => { const Icon=guide.icon; return <article className="docs-card" key={guide.title}><span className="docs-card-icon"><Icon size={19} /></span><h3>{guide.title}</h3><p>{guide.description}</p><Link href={guide.href}>فتح الدليل <ArrowUpLeft size={13} /></Link></article>; })}</div>
      <div className="section-heading"><div><span className="section-overline">أمثلة عملية</span><h2>إرسال طلب HTTP</h2><p>نموذج JavaScript باستخدام Fetch API.</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span>JavaScript · Fetch API</span><span>مثال توضيحي</span></div><pre>{requestExample}</pre></div>
      <div className="section-heading"><div><span className="section-overline">بنية البيانات</span><h2>مثال على الاستجابة</h2><p>شكل JSON افتراضي لتوضيح تنظيم النتيجة.</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span>JSON</span><span>مثال توضيحي</span></div><pre>{responseExample}</pre></div>
      <div className="docs-note"><ShieldCheck size={14} /> جميع الأمثلة هنا تعليمية فقط. لا توجد نقطة اتصال حقيقية متصلة حاليًا، ولا تستخدم عنوان المثال لإرسال بيانات حقيقية.</div>
    </div>
  );
}