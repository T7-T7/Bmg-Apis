import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpLeft, ChevronLeft, Code2, ShieldCheck } from "lucide-react";
import { apiCatalog } from "@/lib/api-data";
import GeminiTester from "@/components/gemini-tester";

type DetailProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return apiCatalog.map(api => ({ slug: api.slug }));
}

export default async function ApiDetailPage({ params }: DetailProps) {
  const { slug } = await params;
  const api = apiCatalog.find(item => item.slug === slug);
  if (!api) notFound();

  const isGemini = api.slug === "aql-gemini";
  const exampleResponse = isGemini
    ? { success: true, response: "مرحبًا! كيف يمكنني مساعدتك؟", sessionId: "SESSION_ID", method: "gemini-web", conversationId: null, responseId: null }
    : { status: "preview", data: { example: "Sample response data" }, note: "Illustrative only — not a live API" };
  const jsExample = isGemini
    ? `const response = await fetch(
  "https://bmg-apis.vercel.app/api/v1/ai/gemini",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_NOX_API_KEY"
    },
    body: JSON.stringify({
      prompt: "اشرح لي الفرق بين let و const",
      instruction: "أجب باللغة العربية",
      sessionId: undefined
    })
  }
);

const data = await response.json();
console.log(data.response);`
    : `const response = await fetch(
  "https://api.example.com${api.endpoint}",
  { method: "${api.method}" }
);
const result = await response.json();
console.log(result);`;

  return (
    <div className="api-detail-page">
      <div className="page-heading">
        <div><div className="eyebrow">كتالوج الواجهات / {api.category}</div><h1>{api.name}</h1><p>{api.description}</p></div>
        <Link href="/apis" className="button-secondary"><ArrowUpLeft size={14} /> العودة للكتالوج</Link>
      </div>
      <section className="page-panel">
        <div className="builder-section-head"><div><h2>معلومات نقطة الاتصال</h2><p>تفاصيل الاستخدام الحالية.</p></div><span className={`service-state ${isGemini ? "ready" : ""}`}><i /> {api.status}</span></div>
        <div className="preview-endpoint"><span className={`method method-${api.method.toLowerCase()}`}>{api.method}</span><code>{api.endpoint}</code></div>
        <div className="preview-details">
          <div className="preview-detail"><span>اسم الواجهة</span><strong>{api.name}</strong></div>
          <div className="preview-detail"><span>التصنيف</span><strong>{api.category}</strong></div>
          <div className="preview-detail"><span>طريقة HTTP</span><strong dir="ltr">{api.method}</strong></div>
          <div className="preview-detail"><span>حد طول prompt</span><strong>{isGemini ? "30,000 حرف" : "—"}</strong></div>
        </div>
      </section>
      {isGemini && <GeminiTester />}
      <div className="section-heading"><div><span className="section-overline">الاستجابة</span><h2>بنية بيانات JSON</h2><p>{isGemini ? "شكل الاستجابة الناجحة من الخدمة." : "مثال توضيحي فقط."}</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span>JSON</span><span>مثال استجابة</span></div><pre>{JSON.stringify(exampleResponse, null, 2)}</pre></div>
      <div className="section-heading"><div><span className="section-overline">دمج الواجهة</span><h2>مثال باستخدام JavaScript</h2><p>طلب HTTP باستخدام Fetch API.</p></div></div>
      <div className="code-panel"><div className="code-panel-head"><span><Code2 size={13} /> JavaScript · Fetch</span><span>ES2022</span></div><pre>{jsExample}</pre></div>
      <div className="docs-note"><ShieldCheck size={14} /> {isGemini ? "تعتمد الخدمة على نقطة اتصال Gemini Web غير موثقة رسميًا؛ قد تتغير أو تتوقف إذا غيّرت Google آلية الاتصال." : "هذه الصفحة تعرض تعريفًا تجريبيًا فقط، ولم يتم تنفيذ نقطة الاتصال بعد."}</div>
      <div className="section-heading"><div><h2>استكشف المزيد</h2><p>ارجع إلى الكتالوج لاختيار واجهة أخرى.</p></div><Link className="text-link" href="/apis">جميع الواجهات <ChevronLeft size={14} /></Link></div>
    </div>
  );
}