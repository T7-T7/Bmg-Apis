import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, BookOpen, Braces, FileJson2, LockKeyhole, Terminal } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "توثيق المطورين",
  description: "مرجع BMG APIs الرسمي: المصادقة، البداية السريعة، واجهة Gemini، أمثلة JavaScript وcURL، رموز الأخطاء وملف OpenAPI.",
  alternates: { canonical: "/docs" },
  robots: { index: true, follow: true },
};

const baseUrl = "https://bmg-apis.vercel.app";
const curlExample = `curl -X POST "${baseUrl}/api/v1/ai/gemini" \\\
  -H "Authorization: Bearer YOUR_BMG_API_KEY" \\\
  -H "Content-Type: application/json" \\\
  -d '{"prompt":"اشرح الفرق بين let و const","instruction":"أجب بالعربية"}'`;
const jsExample = `const response = await fetch("${baseUrl}/api/v1/ai/gemini", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_BMG_API_KEY"
  },
  body: JSON.stringify({
    prompt: "اشرح الفرق بين let و const",
    instruction: "أجب باللغة العربية"
  })
});

const data = await response.json();
console.log(data.response);
console.log(data.sessionId); // استخدمه لمتابعة المحادثة`;
const responseExample = `{
  "success": true,
  "response": "الفرق بين let و const ...",
  "sessionId": "SESSION_ID",
  "method": "gemini-web",
  "conversationId": "c_...",
  "responseId": "r_..."
}`;

function CodeBlock({ label, code }: { label: string; code: string }) {
  return <div className="public-docs-code"><div className="public-docs-code-head"><span>{label}</span><span aria-hidden="true">{label.includes("JSON") ? <Braces size={15}/> : <Terminal size={15}/>}</span></div><pre dir="ltr"><code>{code}</code></pre></div>;
}

const sections = [
  ["overview", "نظرة عامة"],
  ["quickstart", "البداية السريعة"],
  ["authentication", "المصادقة"],
  ["gemini", "Gemini API"],
  ["request", "حقول الطلب"],
  ["responses", "الاستجابات والأخطاء"],
  ["openapi", "OpenAPI"],
];

export default function DocsPage() {
  return (
    <div className="public-docs">
      <header className="public-docs-nav">
        <Link href="/" className="public-docs-brand"><span className="public-docs-mark">B</span><span>BMG <b>APIs</b></span></Link>
        <nav aria-label="التنقل الرئيسي"><Link href="/apis">كتالوج الواجهات</Link><Link href="/status">حالة الخدمات</Link><Link href="/docs">التوثيق</Link></nav>
        <div className="public-docs-nav-actions"><ThemeToggle /><Link href="/dashboard/api-keys" className="public-docs-nav-cta">مفاتيح API <ArrowUpLeft size={15}/></Link></div>
      </header>

      <div className="public-docs-frame">
        <aside className="public-docs-sidebar" aria-label="أقسام التوثيق">
          <div className="public-docs-sidebar-title"><BookOpen size={16}/> التوثيق</div>
          <div className="public-docs-sidebar-group"><span>ابدأ هنا</span>
            <a href="#overview">نظرة عامة</a><a href="#quickstart">البداية السريعة</a><a href="#authentication">المصادقة ومفاتيح API</a>
          </div>
          <div className="public-docs-sidebar-group"><span>واجهات API</span>
            <a href="#gemini">Gemini · توليد النصوص</a>
          </div>
          <div className="public-docs-sidebar-group"><span>المراجع</span>
            <a href="#request">حقول الطلب</a><a href="#responses">الاستجابات والأخطاء</a><a href="#openapi">OpenAPI Specification</a>
          </div>
          <div className="public-docs-sidebar-bottom"><span className="public-docs-live-dot"/> مرجع الواجهات المنشورة</div>
        </aside>

        <main className="public-docs-content">
          <div className="public-docs-breadcrumb"><Link href="/">BMG APIs</Link><span>/</span><span>المطورون</span><span>/</span><strong>التوثيق</strong></div>
          <section id="overview" className="public-docs-intro">
            <div className="public-docs-eyebrow"><span/> وثائق المطورين</div>
            <h1>توثيق <em>BMG APIs</em></h1>
            <p>مرجع عملي لربط تطبيقاتك بواجهات BMG APIs. ستجد هنا تفاصيل المصادقة، وبنية الطلبات، وأمثلة قابلة للنسخ، والاستجابات المتوقعة.</p>
            <div className="public-docs-meta"><span>REST API</span><span>JSON</span><span>HTTPS</span><a href="/docs.md">نسخة Markdown <ArrowUpLeft size={13}/></a></div>
          </section>

          <section id="quickstart" className="public-docs-section">
            <div className="public-docs-section-heading"><span>01</span><h2>البداية السريعة</h2></div>
            <p>أرسل طلب HTTP من الخادم إلى نقطة النهاية، وأرفق مفتاح BMG في ترويسة Authorization. جميع أجسام الطلبات والاستجابات تستخدم JSON.</p>
            <CodeBlock label="BASH · CURL" code={curlExample}/>
          </section>

          <section id="authentication" className="public-docs-section">
            <div className="public-docs-section-heading"><span>02</span><h2>المصادقة</h2></div>
            <p>تتطلب الواجهة مفتاح API نشطًا. أنشئ المفتاح من لوحة التحكم ثم خزّنه في متغير بيئة على الخادم. لا تضع المفتاح في كود المتصفح أو مستودع عام.</p>
            <div className="public-docs-callout"><LockKeyhole size={18}/><div><strong>استخدم Bearer Authentication</strong><p>أرسل الترويسة بالشكل التالي: <code dir="ltr">Authorization: Bearer YOUR_BMG_API_KEY</code></p></div></div>
          </section>

          <section id="gemini" className="public-docs-section">
            <div className="public-docs-section-heading"><span>03</span><h2>Gemini · توليد النصوص</h2></div>
            <p>يرسل هذا المسار prompt إلى خدمة Gemini ويعيد النص الناتج ومعرّف جلسة يمكن استخدامه في الطلب التالي لمتابعة المحادثة.</p>
            <div className="public-docs-endpoint"><b>POST</b><code dir="ltr">{baseUrl}/api/v1/ai/gemini</code></div>
            <div className="public-docs-facts"><div><small>Content-Type</small><strong>application/json</strong></div><div><small>الحد الأقصى لـ prompt</small><strong>30,000 حرف</strong></div><div><small>معدل الطلبات</small><strong>30 / دقيقة لكل مفتاح</strong></div></div>
            <h3>مثال JavaScript</h3>
            <CodeBlock label="JAVASCRIPT · FETCH" code={jsExample}/>
          </section>

          <section id="request" className="public-docs-section">
            <div className="public-docs-section-heading"><span>04</span><h2>حقول الطلب</h2></div>
            <p>أرسل الحقول التالية داخل جسم الطلب بصيغة JSON.</p>
            <div className="public-docs-params">
              <div><code>prompt</code><b>string · مطلوب</b><p>النص أو السؤال المراد إرساله إلى النموذج. من حرف واحد حتى 30,000 حرف.</p></div>
              <div><code>instruction</code><b>string · اختياري</b><p>تعليمات إضافية لتحديد أسلوب الرد أو لغته أو سياقه.</p></div>
              <div><code>sessionId</code><b>string · اختياري</b><p>معرّف الجلسة الذي أعادته الاستجابة السابقة لمتابعة المحادثة.</p></div>
            </div>
          </section>

          <section id="responses" className="public-docs-section">
            <div className="public-docs-section-heading"><span>05</span><h2>الاستجابات والأخطاء</h2></div>
            <p>مثال توضيحي لبنية الاستجابة الناجحة.</p>
            <CodeBlock label="JSON · 200 OK" code={responseExample}/>
            <div className="public-docs-errors">
              <div><code>400</code><span>بيانات الطلب غير صحيحة أو حقل مطلوب مفقود.</span></div>
              <div><code>401</code><span>مفتاح API مفقود أو غير صالح أو ملغى.</span></div>
              <div><code>413</code><span>تجاوز prompt الحد الأقصى المسموح.</span></div>
              <div><code>429</code><span>تجاوز حد 30 طلبًا في الدقيقة لكل مفتاح.</span></div>
              <div><code>502</code><span>تعذر الحصول على استجابة من مزود النموذج.</span></div>
              <div><code>503</code><span>الخدمة أو التحقق من المفتاح غير متاح مؤقتًا.</span></div>
            </div>
          </section>

          <section id="openapi" className="public-docs-section">
            <div className="public-docs-section-heading"><span>06</span><h2>OpenAPI Specification</h2></div>
            <p>لأدوات المطورين والمساعدات البرمجية، يتوفر تعريف آلي للمسار المنشور وحقول الطلب والمصادقة والاستجابات.</p>
            <a className="public-docs-openapi-link" href="/api/openapi.json"><FileJson2 size={19}/><span><strong>openapi.json</strong><small>{baseUrl}/api/openapi.json</small></span><ArrowUpLeft size={15}/></a>
            <a className="public-docs-text-link" href="/docs.md">قراءة التوثيق كنص Markdown <ArrowUpLeft size={13}/></a>
          </section>
          <footer className="public-docs-footer"><span>© 2026 BMG APIs</span><span>توثيق المطورين</span><Link href="/apis">استكشف الواجهات <ArrowUpLeft size={13}/></Link></footer>
        </main>

        <aside className="public-docs-right" aria-label="على هذه الصفحة"><strong>على هذه الصفحة</strong>{sections.map(([id,label])=><a key={id} href={`#${id}`}>{label}</a>)}<a className="public-docs-download" href="/api/openapi.json"><Braces size={14}/> OpenAPI JSON</a></aside>
      </div>
    </div>
  );
}
