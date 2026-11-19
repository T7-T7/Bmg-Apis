"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Braces, Check, Code2, Eye, Info, Rocket } from "lucide-react";
import type { ApiCategory, HttpMethod } from "@/lib/api-data";

type ApiDraft = {
  name: string;
  slug: string;
  description: string;
  category: ApiCategory;
  method: HttpMethod;
  endpoint: string;
};

const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const categories: ApiCategory[] = ["ذكاء اصطناعي", "وسائط", "نصوص", "أدوات مساعدة", "ترفيه"];

export default function CreatePage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ApiCategory>("أدوات مساعدة");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [endpoint, setEndpoint] = useState("/api/v1/my-endpoint");
  const [submitted, setSubmitted] = useState(false);

  const normalizedSlug = useMemo(() => slug.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), [slug, name]);
  const draft: ApiDraft = { name: name.trim(), slug: normalizedSlug, description: description.trim(), category, method, endpoint: endpoint.trim() };
  const errors = {
    name: name.trim().length < 2,
    endpoint: !/^\/[a-zA-Z0-9/_-]+$/.test(endpoint.trim()),
  };
  const valid = !errors.name && !errors.endpoint;

  function handlePreview() {
    setSubmitted(true);
  }

  return (
    <div className="builder-page">
      <div className="page-heading">
        <div><div className="eyebrow">مساحة المطور / أدوات الإنشاء</div><h1>منشئ واجهات API</h1><p>عرّف واجهتك خطوة بخطوة، وراقب شكل نقطة الاتصال قبل الانتقال إلى مرحلة التنفيذ.</p></div>
      </div>
      <div className="builder-intro">
        <span className="builder-intro-icon"><Braces size={21} /></span>
        <div className="builder-intro-copy"><strong>تعريف واجهة جديد</strong><p>الحقول التالية تنشئ مسودة محلية قابلة للمعاينة، ولا تحفظها على الخادم بعد.</p></div>
      </div>

      <div className="builder-layout">
        <section className="builder-main">
          <div className="builder-section-head"><div><h2>إعدادات الواجهة</h2><p>أدخل البيانات الأساسية وحدد طريقة الوصول إلى المورد.</p></div><span className="required-label">* مطلوب</span></div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="api-name">اسم الواجهة <em>*</em></label>
              <input id="api-name" value={name} onChange={event => setName(event.target.value)} placeholder="مثال: خدمة الطقس" autoComplete="off" aria-invalid={submitted && errors.name} />
              {submitted && errors.name && <small className="form-error">أدخل اسمًا لا يقل عن حرفين.</small>}
            </div>
            <div className="form-field">
              <label htmlFor="api-slug">المعرّف المختصر</label>
              <input id="api-slug" className="input-ltr" value={slug} onChange={event => setSlug(event.target.value)} placeholder="weather-service" autoComplete="off" />
              <small>يُستخدم كمعرّف ثابت للواجهة.</small>
            </div>
            <div className="form-field">
              <label htmlFor="api-category">مجال الواجهة</label>
              <select id="api-category" value={category} onChange={event => setCategory(event.target.value as ApiCategory)}>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select>
            </div>
            <div className="form-field">
              <label>طريقة الطلب</label>
              <div className="method-picker" role="group" aria-label="طريقة طلب HTTP">
                {methods.map(item => <button key={item} type="button" className="method-option" onClick={() => setMethod(item)} aria-pressed={method === item}>{item}</button>)}
              </div>
            </div>
            <div className="form-field full">
              <label htmlFor="api-description">وصف الواجهة</label>
              <textarea id="api-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="اشرح ما الذي تفعله الواجهة، وما نوع البيانات التي تعيدها..." />
              <small>اكتب وصفًا واضحًا يساعد المطورين على فهم الاستخدام المتوقع.</small>
            </div>
            <div className="form-field full">
              <label htmlFor="api-endpoint">مسار نقطة الاتصال <em>*</em></label>
              <input id="api-endpoint" className="input-ltr" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="/api/v1/resource" spellCheck={false} />
              <small>استخدم مسارًا يبدأ بـ / ويحتوي على أحرف إنجليزية وأرقام وشرطات فقط.</small>
              {submitted && errors.endpoint && <small className="form-error">المسار غير صالح. مثال صحيح: /api/v1/weather</small>}
            </div>
          </div>
          <div className="builder-actions"><p>لن يتم نشر أو حفظ أي شيء عند المعاينة.</p><button type="button" className="button-primary" onClick={handlePreview}><Eye size={15} /> التحقق ومعاينة التعريف</button></div>
        </section>

        <aside className="builder-aside builder-preview">
          <div className="preview-head"><strong>معاينة مباشرة</strong><span className="preview-live"><i /> محلي</span></div>
          <div className="preview-endpoint"><span className={`method method-${method.toLowerCase()}`}>{method}</span><code>{endpoint || "/api/v1/..."}</code></div>
          <div className="preview-details">
            <div className="preview-detail"><span>اسم الواجهة</span><strong>{name.trim() || "غير محدد"}</strong></div>
            <div className="preview-detail"><span>المعرّف</span><strong dir="ltr">{normalizedSlug || "—"}</strong></div>
            <div className="preview-detail"><span>التصنيف</span><strong>{category}</strong></div>
            <div className="preview-detail"><span>طريقة الطلب</span><strong dir="ltr">{method}</strong></div>
          </div>
          <pre className="preview-json">{JSON.stringify(draft, null, 2)}</pre>
          {submitted && valid ? <div className="builder-warning" style={{borderColor:"rgba(101,230,189,.25)",background:"rgba(101,230,189,.05)",color:"#a9dccc"}}><Check size={14} /><span>التعريف صالح للمعاينة. لم يتم حفظه أو نشره.</span></div> : <div className="builder-warning"><Info size={14} /><span>المعاينة تتحدث تلقائيًا. اضغط تحديث المعاينة للتحقق من الحقول المطلوبة.</span></div>}
          {submitted && !valid && <div className="builder-warning"><AlertCircle size={14} /><span>راجع الحقول المحددة قبل اعتماد المعاينة.</span></div>}
        </aside>
      </div>
    </div>
  );
}