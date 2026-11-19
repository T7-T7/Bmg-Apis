"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Code2, Info, ShieldCheck, UploadCloud, X } from "lucide-react";
import type { ApiCategory, HttpMethod } from "@/lib/api-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const categories: ApiCategory[] = ["ذكاء اصطناعي", "وسائط", "نصوص", "أدوات مساعدة", "ترفيه"];
const starterTest = `// اختبار صحة الخدمة
const response = await fetch("https://example.com/health");
if (!response.ok) throw new Error("API returned " + response.status);
const data = await response.json();
console.log(data);`;

export default function ContributePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ApiCategory>("أدوات مساعدة");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [endpoint, setEndpoint] = useState("");
  const [testCode, setTestCode] = useState(starterTest);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const valid = name.trim().length >= 2 && description.trim().length >= 10 && /^https:\/\/.+/.test(endpoint.trim()) && testCode.trim().length >= 20;

  async function submit() {
    setBusy(true); setError(""); setNotice("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { setNeedsLogin(true); return; }
      const slug = "community-" + crypto.randomUUID().slice(0, 12);
      const { error: insertError } = await supabase.from("api_submissions").insert({
        user_id: auth.user.id,
        name: name.trim(),
        slug,
        description: description.trim(),
        category,
        endpoint_url: endpoint.trim(),
        http_method: method,
        documentation: "تم إرسال الخدمة لمراجعة المشرف.",
        healthcheck_config: { type: "javascript", code: testCode, submittedAt: new Date().toISOString() },
      });
      if (insertError) throw insertError;
      setNotice("تم إرسال اقتراحك بنجاح. سيظهر في مساهماتك بحالة «قيد المراجعة».");
      setName(""); setDescription(""); setEndpoint(""); setTestCode(starterTest);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إرسال المساهمة.");
    } finally { setBusy(false); }
  }

  return (
    <div className="builder-page">
      <div className="page-heading"><div><div className="eyebrow">مساهمات المجتمع / إرسال للمراجعة</div><h1>اقترح واجهة API</h1><p>أرسل خدمة مفيدة للمطورين. لن تظهر في الكتالوج العام إلا بعد مراجعة المشرف واجتياز الفحص.</p></div></div>
      <div className="builder-intro"><span className="builder-intro-icon"><UploadCloud size={21} /></span><div className="builder-intro-copy"><strong>طلب إضافة API إلى الكتالوج</strong><p>أدخل بيانات الخدمة وأرفق كود اختبار يوضح كيف نتحقق من عملها.</p></div></div>
      <div className="builder-layout">
        <section className="builder-main">
          <div className="builder-section-head"><div><h2>بيانات الواجهة</h2><p>معلومات واضحة تساعد المشرف والمستخدم على فهم الخدمة.</p></div><span className="required-label">* مطلوب</span></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="api-name">اسم الواجهة <em>*</em></label><input id="api-name" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: خدمة تحويل الصور" /></div>
            <div className="form-field"><label htmlFor="api-category">التصنيف</label><select id="api-category" value={category} onChange={e => setCategory(e.target.value as ApiCategory)}>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
            <div className="form-field full"><label htmlFor="api-description">وصف الخدمة <em>*</em></label><textarea id="api-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="ما وظيفة هذه الواجهة؟ وما الذي يحصل عليه المطور عند استخدامها؟" /></div>
            <div className="form-field"><label htmlFor="api-endpoint">رابط API الأساسي <em>*</em></label><input id="api-endpoint" className="input-ltr" dir="ltr" value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://api.example.com/v1" /></div>
            <div className="form-field"><label>طريقة الطلب الأساسية</label><div className="method-picker" role="group" aria-label="طريقة HTTP">{methods.map(item => <button key={item} type="button" className="method-option" onClick={() => setMethod(item)} aria-pressed={method === item}>{item}</button>)}</div></div>
            <div className="form-field full"><label htmlFor="api-test">كود اختبار API <em>*</em></label><textarea id="api-test" className="code-input" dir="ltr" spellCheck={false} value={testCode} onChange={e => setTestCode(e.target.value)} /><small>يُحفظ الكود للمراجعة فقط. لن يتم تشغيله مباشرة على خادم الإنتاج؛ نحتاج بيئة Sandbox معزولة قبل تفعيل الفحص الآلي.</small></div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-success">{notice} <Link href="/my-apis">عرض مساهماتي</Link></div>}
          <div className="builder-actions"><p>كل طلب جديد يبدأ بحالة «قيد المراجعة» ولا يُنشر تلقائيًا.</p><button type="button" className="button-primary" disabled={!valid || busy} onClick={submit}><UploadCloud size={15} /> {busy ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</button></div>
          {!valid && <div className="builder-warning"><AlertCircle size={14} /><span>أكمل الاسم والوصف والرابط وكود الاختبار لتفعيل الإرسال.</span></div>}
        </section>
        <aside className="builder-aside builder-preview">
          <div className="preview-head"><strong>دورة اعتماد الواجهة</strong><span className="preview-live"><i /> مراجعة مطلوبة</span></div>
          <div className="review-step"><span>01</span><div><strong>مراجعة المشرف</strong><small>البيانات، المصدر، وسياسة الاستخدام.</small></div></div>
          <div className="review-step"><span>02</span><div><strong>فحص كود الاختبار</strong><small>مراجعة ثابتة قبل تشغيله في بيئة معزولة.</small></div></div>
          <div className="review-step"><span>03</span><div><strong>اختبار الخدمة</strong><small>التحقق من الاستجابة والمهلة والأخطاء.</small></div></div>
          <div className="review-step"><span>04</span><div><strong>اعتماد ونشر</strong><small>تظهر في الكتالوج بعد موافقة المشرف.</small></div></div>
          <div className="docs-note"><ShieldCheck size={14} /> يحق للمشرف تعليق الواجهة أو حذفها إذا تعطلت أو خالفت شروط المنصة.</div>
        </aside>
      </div>
      {needsLogin && <div className="auth-sheet-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setNeedsLogin(false); }}><div className="auth-sheet" role="dialog" aria-modal="true" aria-labelledby="auth-sheet-title"><button className="auth-sheet-close" onClick={() => setNeedsLogin(false)} aria-label="إغلاق"><X size={18} /></button><span className="auth-sheet-icon"><ShieldCheck size={22} /></span><h2 id="auth-sheet-title">سجّل الدخول للمتابعة</h2><p>إرسال مساهمة جديدة يتطلب حساب BMG APIs حتى تتمكن من متابعة المراجعة.</p><Link className="button-primary" href="/login?next=/create">تسجيل الدخول</Link><Link className="auth-sheet-signup" href="/signup?next=/create">إنشاء حساب جديد</Link></div></div>}
    </div>
  );
}
