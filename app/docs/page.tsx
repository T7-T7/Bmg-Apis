import Link from "next/link";
import { ArrowUpLeft, BookOpen, Code2, ShieldCheck, Activity, Sparkles } from "lucide-react";

const guides = [
  { title: "استخدام واجهات API", description: "اختر الخدمة من الكتالوج، ثم استخدم الرابط والطريقة والمعاملات الموضحة.", href: "/apis", icon: Code2 },
  { title: "إرسال مساهمة", description: "تعرف على البيانات المطلوبة وكود الاختبار الذي يرفقه ناشر الواجهة.", href: "/create", icon: BookOpen },
  { title: "حالة الخدمات", description: "افهم حالات التشغيل ونتائج الفحص الدوري للخدمات.", href: "/status", icon: Activity },
];

const requestExample = `const response = await fetch(
  "https://bmg-apis.vercel.app/api/v1/ai/gemini",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "اشرح لي الفرق بين let و const",
      instruction: "أجب باللغة العربية",
      sessionId: undefined
    })
  }
);

const data = await response.json();
console.log(data.response);
console.log(data.sessionId); // احتفظ به لمتابعة المحادثة`;

const responseExample = `{
  "success": true,
  "response": "النص الذي أنشأه Gemini...",
  "sessionId": "SESSION_ID",
  "method": "gemini-web",
  "conversationId": "c_...",
  "responseId": "r_..."
}`;

export default function DocsPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مركز المعرفة / المطورون</div><h1>توثيق المطورين</h1><p>طريقة استخدام الخدمات المتاحة، وآلية اقتراح واجهات جديدة للمجتمع.</p></div></div>
      <div className="docs-grid">{guides.map(guide => { const Icon = guide.icon; return <article className="docs-card" key={guide.title}><span className="docs-card-icon"><Icon size={19} /></span><h3>{guide.title}</h3><p>{guide.description}</p><Link href={guide.href}>فتح القسم <ArrowUpLeft size={13} /></Link></article>; })}</div>
      <div className="section-heading"><div><span className="section-overline">أول خدمة فعلية</span><h2><Sparkles size={18} /> عقل — Gemini</h2><p>واجهة محادثة نصية تقبل prompt حتى 30,000 حرف وتدعم متابعة الجلسة.</p></div><Link href="/apis/aql-gemini" className="text-link">تفاصيل الخدمة <ArrowUpLeft size={14} /></Link></div>
      <div className="code-panel"><div className="code-panel-head"><span>JavaScript · Fetch API</span><span>POST</span></div><pre>{requestExample}</pre></div>
      <div className="section-heading"><div><span className="section-overline">الاستجابة الناجحة</span><h2>بنية JSON</h2><p>احتفظ بـ sessionId لإرسال رسالة متابعة ضمن نفس المحادثة.</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span>JSON</span><span>200 OK</span></div><pre>{responseExample}</pre></div>
      <div className="docs-note"><ShieldCheck size={14} /> حد prompt هو 30,000 حرف. الخدمة تعتمد على نقطة اتصال Gemini Web غير موثقة رسميًا وقد تتغير من جهة Google. يوجد حد مؤقت أولي للطلبات لكل عنوان IP، وسيتم استبداله بنظام مفاتيح وحصص مركزي قبل فتح الاستخدام الواسع.</div>
      <div className="section-heading"><div><span className="section-overline">مساهمات المجتمع</span><h2>اقتراح واجهة جديدة</h2><p>كل API يضيفها المجتمع تمر بمراجعة المشرف وفحص كود الاختبار قبل النشر.</p></div><Link href="/create" className="text-link">إرسال مساهمة <ArrowUpLeft size={14} /></Link></div>
    </div>
  );
}