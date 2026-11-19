"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpLeft, Braces, Check, Code2, Eye, FileCode2, Info, Layers3, Rocket, WandSparkles } from "lucide-react";
import type { HttpMethod, ApiCategory } from "@/lib/api-data";

type ApiDraft = { name: string; slug: string; description: string; category: ApiCategory; method: HttpMethod; endpoint: string };

export default function CreatePage() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("/api/v1/my-endpoint");
  const [category, setCategory] = useState<ApiCategory>("أدوات مساعدة");
  const [preview, setPreview] = useState<ApiDraft | null>(null);

  function showPreview() {
    setPreview({ name, slug, description, category, method, endpoint });
  }

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">منشئ الواجهات / معاينة</div><h1>إنشاء واجهة API</h1><p>أنشئ تعريفًا أوليًا لنقطة اتصال API من خلال خطوات واضحة. لن يتم حفظ البيانات حاليًا.</p></div></div>
      <div className="builder-steps">
        <span className="builder-step active"><span>01</span> المعلومات الأساسية</span>
        <span className="builder-step"><span>02</span> نقطة الاتصال</span>
        <span className="builder-step"><span>03</span> المدخلات</span>
        <span className="builder-step"><span>04</span> الاستجابة</span>
        <span className="builder-step"><span>05</span> الاختبار والنشر</span>
      </div>
      <div className="builder-layout">
        <section className="panel builder-main">
          <div className="section-title section-title-first"><div><h2>المعلومات الأساسية</h2><p>أدخل بيانات تساعد المطورين على فهم واجهتك.</p></div><span className="required-hint">* حقل مطلوب</span></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="api-name">اسم الواجهة <span>*</span></label><input id="api-name" value={name} onChange={event => setName(event.target.value)} placeholder="مثال: واجهة الطقس" autoComplete="off" required /></div>
            <div className="form-field"><label htmlFor="api-slug">المعرّف المختصر</label><input id="api-slug" value={slug} onChange={event => setSlug(event.target.value)} placeholder="weather-api" dir="ltr" autoComplete="off" /><small>يُستخدم في عنوان الواجهة.</small></div>
            <div className="form-field"><label htmlFor="api-category">التصنيف</label><select id="api-category" value={category} onChange={event => setCategory(event.target.value as ApiCategory)}>{(["ذكاء اصطناعي", "وسائط", "نصوص", "أدوات مساعدة", "ترفيه"] as const).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="form-field"><label htmlFor="api-method">طريقة الطلب <span>*</span></label><select id="api-method" value={method} onChange={event => setMethod(event.target.value as HttpMethod)}>{(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map(item => <option key={item} value={item}>{item}</option>)}</select><small>طرق HTTP القياسية.</small></div>
            <div className="form-field full"><label htmlFor="api-description">وصف الواجهة</label><textarea id="api-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="اشرح وظيفة الواجهة والنتيجة التي تقدمها..." /></div>
            <div className="form-field full"><label htmlFor="api-endpoint">مسار نقطة الاتصال <span>*</span></label><div className="input-with-prefix"><Code2 size={15} /><input id="api-endpoint" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="/api/v1/your-route" dir="ltr" /></div><small>يجب أن يبدأ المسار بعلامة /.</small></div>
          </div>
          <div className="form-actions"><button className="primary-btn" onClick={showPreview} disabled={!name.trim() || !endpoint.trim()}>معاينة التعريف <Eye size={15} /></button></div>
          {preview && <div className="panel definition-preview"><div className="section-title section-title-first"><div><h2>معاينة التعريف</h2><p>بيانات الواجهة بصيغة JSON</p></div><span className="preview-tag"><Check size={12} /> جاهز للمعاينة</span></div><pre className="code-block" dir="ltr">{JSON.stringify(preview, null, 2)}</pre><p className="note-text"><Info size={13} /> هذه معاينة داخل المتصفح فقط؛ لم يتم ربط الحفظ أو إنشاء نقاط الاتصال بالخادم.</p></div>}
        </section>
        <aside className="panel builder-side">
          <div className="section-title section-title-first"><div><h2>ملخص نقطة الاتصال</h2><p>معاينة مباشرة للمسار</p></div><Braces size={17} /></div>
          <div className="endpoint endpoint-large" dir="ltr"><strong>{method}</strong> {endpoint}</div>
          <div className="muted-box side-note"><Info size={15} /><span>سيقوم الخادم مستقبلًا بالتحقق من التعريف وحفظه وإنشاء المسارات ونشر الواجهات بصورة آمنة.</span></div>
          <div className="section-title"><div><h2>الخطوات التالية</h2><p>مراحل إعداد الواجهة</p></div></div>
          {["تحديد معاملات الطلب", "تعريف بنية الاستجابة", "تنفيذ طلب تجريبي", "نشر نقطة الاتصال"].map((item, index) => <div className="status-row" key={item}><span className="step-number">{index + 1}</span><div className="status-meta">{item}</div></div>)}
          <div className="builder-coming"><Rocket size={16} /><span>النشر الفعلي متاح بعد تجهيز الخادم.</span></div>
        </aside>
      </div>
    </>
  );
}