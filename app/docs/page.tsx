import Link from "next/link";
import { ArrowUpLeft, BookOpen, Braces, Check, Code2, ExternalLink, FileJson2, ShieldCheck, Terminal } from "lucide-react";

const baseUrl = "https://bmg-apis.vercel.app";
const curlExample = `curl -X POST "${baseUrl}/api/v1/ai/gemini" \\\
  -H "Authorization: Bearer YOUR_BMG_API_KEY" \\\
  -H "Content-Type: application/json" \\\
  -d '{
    "prompt": "اشرح لي الفرق بين let و const",
    "instruction": "أجب باللغة العربية"
  }'`;

const jsExample = `const response = await fetch(
  "${baseUrl}/api/v1/ai/gemini",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_BMG_API_KEY"
    },
    body: JSON.stringify({
      prompt: "اشرح لي الفرق بين let و const",
      instruction: "أجب باللغة العربية"
    })
  }
);

const data = await response.json();
console.log(data.response);
console.log(data.sessionId); // أرسله في الطلب التالي لمتابعة المحادثة`;

const responseExample = `{
  "success": true,
  "response": "الفرق بين let و const ...",
  "sessionId": "SESSION_ID",
  "method": "gemini-web",
  "conversationId": "c_...",
  "responseId": "r_..."
}`;

function CodeBlock({ label, code }: { label: string; code: string }) {
  return <div className="public-docs-code"><div className="public-docs-code-head"><span>{label}</span><button type="button" onClick={undefined} aria-label="مثال برمجي">{label === "JSON" ? <Braces size={15}/> : <Terminal size={15}/>}</button></div><pre dir="ltr"><code>{code}</code></pre></div>;
}

export default function DocsPage() {
  return (
    <div className="public-docs">
      <header className="public-docs-nav">
        <Link href="/" className="public-docs-brand"><span className="public-docs-mark">B</span><span>BMG <b>APIs</b></span></Link>
        <nav aria-label="التنقل في التوثيق">
          <Link href="/apis">واجهات API</Link>
          <a href="#quickstart">البداية السريعة</a>
          <a href="#reference">مرجع API</a>
          <Link href="/status">حالة الخدمات</Link>
        </nav>
        <Link href="/dashboard/api-keys" className="public-docs-nav-cta">مفاتيح API <ArrowUpLeft size={15}/></Link>
      </header>

      <main className="public-docs-main">
        <div className="public-docs-breadcrumb"><Link href="/">BMG APIs</Link><span>/</span><span>التوثيق</span></div>
        <section className="public-docs-hero">
          <div className="public-docs-eyebrow"><BookOpen size={15}/> مركز المطورين</div>
          <h1>ابنِ باستخدام<br/><em>BMG APIs.</em></h1>
          <p>كل ما تحتاجه للاتصال بخدمات BMG APIs، من أول طلب إلى دمج الواجهة في تطبيقك.</p>
          <div className="public-docs-hero-actions">
            <a href="#quickstart" className="public-docs-primary">ابدأ الآن <ArrowUpLeft size={16}/></a>
            <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="public-docs-secondary"><FileJson2 size={16}/> OpenAPI JSON <ExternalLink size={13}/></a>
          </div>
        </section>

        <div className="public-docs-layout">
          <aside className="public-docs-toc">
            <span>في هذه الصفحة</span>
            <a href="#quickstart">البداية السريعة</a>
            <a href="#authentication">المصادقة</a>
            <a href="#reference">مرجع الواجهة</a>
            <a href="#responses">الاستجابات والأخطاء</a>
            <a href="#openapi">تعريف OpenAPI</a>
          </aside>

          <article className="public-docs-article">
            <section id="quickstart" className="public-docs-section">
              <div className="public-docs-section-kicker">01 / البداية</div>
              <h2>أرسل أول طلب API</h2>
              <p>تعمل واجهات BMG APIs عبر HTTP. أرسل الطلب إلى عنوان الخدمة مع مفتاحك في ترويسة Authorization، ثم اقرأ الاستجابة بصيغة JSON.</p>
              <CodeBlock label="BASH · CURL" code={curlExample}/>
            </section>

            <section id="authentication" className="public-docs-section">
              <div className="public-docs-section-kicker">02 / الأمان</div>
              <h2>المصادقة باستخدام مفتاح API</h2>
              <p>كل طلب إلى الخدمة يتطلب مفتاحًا نشطًا. أنشئ مفتاحًا من لوحة التحكم، واحتفظ به على الخادم ولا تضعه في كود المتصفح أو المستودعات العامة.</p>
              <div className="public-docs-callout"><ShieldCheck size={19}/><div><strong>حافظ على سرية مفتاحك</strong><p>أرسل المفتاح في الترويسة <code>Authorization: Bearer YOUR_BMG_API_KEY</code>. لا ترسله ضمن عنوان URL أو جسم الطلب.</p></div></div>
            </section>

            <section id="reference" className="public-docs-section">
              <div className="public-docs-section-kicker">03 / مرجع API</div>
              <h2>عقل — Gemini</h2>
              <p>توليد رد نصي باستخدام Gemini، مع دعم التعليمات الاختيارية ومتابعة المحادثة عبر معرّف الجلسة.</p>
              <div className="public-docs-endpoint"><span>POST</span><code dir="ltr">{baseUrl}/api/v1/ai/gemini</code></div>
              <div className="public-docs-facts">
                <div><small>نوع المحتوى</small><strong>application/json</strong></div>
                <div><small>الحد الأقصى لـ prompt</small><strong>30,000 حرف</strong></div>
                <div><small>معدل الطلبات</small><strong>30 طلبًا / دقيقة لكل مفتاح</strong></div>
              </div>
              <h3>جسم الطلب</h3>
              <div className="public-docs-params">
                <div><code>prompt</code><b>string · مطلوب</b><p>النص أو السؤال المراد إرساله إلى النموذج.</p></div>
                <div><code>instruction</code><b>string · اختياري</b><p>تعليمات تحدد أسلوب الرد أو سياقه.</p></div>
                <div><code>sessionId</code><b>string · اختياري</b><p>معرّف الجلسة الذي تعيده الاستجابة السابقة لمتابعة المحادثة.</p></div>
              </div>
              <h3>مثال JavaScript</h3>
              <CodeBlock label="JAVASCRIPT · FETCH" code={jsExample}/>
            </section>

            <section id="responses" className="public-docs-section">
              <div className="public-docs-section-kicker">04 / النتائج</div>
              <h2>الاستجابة الناجحة</h2>
              <p>عند نجاح الطلب، تعيد الخدمة النص الناتج ومعرّف الجلسة والبيانات المرجعية المتاحة.</p>
              <CodeBlock label="JSON · 200 OK" code={responseExample}/>
              <h3>رموز الأخطاء</h3>
              <div className="public-docs-errors">
                <div><code>400</code><span>بيانات الطلب غير صحيحة أو ينقصها حقل مطلوب.</span></div>
                <div><code>401</code><span>مفتاح API مفقود أو غير صالح أو ملغى.</span></div>
                <div><code>413</code><span>تجاوز prompt الحد الأقصى المسموح.</span></div>
                <div><code>429</code><span>تجاوز حد 30 طلبًا في الدقيقة.</span></div>
                <div><code>502</code><span>تعذر الحصول على استجابة من مزود النموذج.</span></div>
                <div><code>503</code><span>الخدمة أو التحقق من المفتاح غير متاح مؤقتًا.</span></div>
              </div>
            </section>

            <section id="openapi" className="public-docs-section public-docs-openapi">
              <div className="public-docs-section-kicker">05 / للأدوات والمساعدات</div>
              <h2>تعريف OpenAPI</h2>
              <p>استخدم ملف OpenAPI للحصول على تعريف آلي للمسارات والطرق والحقول والمصادقة. هذا الملف يصف الواجهة المنشورة فعليًا فقط، ولا يدرج أمثلة الكتالوج التجريبية كواجهات متاحة.</p>
              <a href="/api/openapi.json" target="_blank" rel="noreferrer" className="public-docs-openapi-link"><FileJson2 size={18}/><span><strong>openapi.json</strong><small>{baseUrl}/api/openapi.json</small></span><ExternalLink size={15}/></a>
            </section>
          </article>
        </div>

        <footer className="public-docs-footer"><span>© 2026 BMG APIs</span><span>توثيق واجهات البرمجة</span><Link href="/apis">استكشف الكتالوج <ArrowUpLeft size={13}/></Link></footer>
      </main>
    </div>
  );
}
