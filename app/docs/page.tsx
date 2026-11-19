import Link from "next/link";
import { ArrowUpLeft, BookOpen, Code2, ShieldCheck, Activity } from "lucide-react";

const guides = [
  { title: "استخدام واجهات API", description: "اختر الخدمة من الكتالوج، ثم استخدم الرابط والطريقة والمعاملات الموضحة.", href: "/apis", icon: Code2 },
  { title: "إرسال مساهمة", description: "تعرف على البيانات المطلوبة وكود الاختبار الذي يرفقه ناشر الواجهة.", href: "/create", icon: BookOpen },
  { title: "حالة الخدمات", description: "افهم حالات التشغيل ونتائج الفحص الدوري للخدمات.", href: "/status", icon: Activity },
];

const requestExample = `const response = await fetch(
  "https://api.bmg-studio.com/v1/example",
  {
    method: "GET",
    headers: {
      "x-api-key": "YOUR_API_KEY"
    }
  }
);

const data = await response.json();
console.log(data);`;

const responseExample = `{
  "success": true,
  "data": {},
  "requestId": "example-id"
}`;

export default function DocsPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مركز المعرفة / المطورون</div><h1>توثيق المطورين</h1><p>طريقة استكشاف الخدمات واستخدامها، وآلية اقتراح واجهات جديدة للمجتمع.</p></div></div>
      <div className="docs-grid">{guides.map(guide => { const Icon = guide.icon; return <article className="docs-card" key={guide.title}><span className="docs-card-icon"><Icon size={19} /></span><h3>{guide.title}</h3><p>{guide.description}</p><Link href={guide.href}>فتح القسم <ArrowUpLeft size={13} /></Link></article>; })}</div>
      <div className="section-heading"><div><span className="section-overline">مثال توضيحي</span><h2>إرسال طلب HTTP</h2><p>صيغة عامة فقط؛ استبدل العنوان بمسار خدمة منشورة فعليًا.</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span>JavaScript · Fetch API</span><span>مثال</span></div><pre>{requestExample}</pre></div>
      <div className="section-heading"><div><span className="section-overline">استجابة JSON</span><h2>قراءة النتيجة</h2><p>بنية افتراضية لتوضيح شكل البيانات.</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span>JSON</span><span>مثال</span></div><pre>{responseExample}</pre></div>
      <div className="docs-note"><ShieldCheck size={14} /> لا تعتبر الأمثلة أعلاه عناوين تشغيل حقيقية. ستُعرض بيانات الاتصال الفعلية في صفحة كل API بعد تنفيذ الخدمة واعتمادها.</div>
    </div>
  );
}