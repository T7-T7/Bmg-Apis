"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ENDPOINT = "/api/v1/ai/star-x";
const ACTIONS = [
  { value: "edit-scene", label: "تعديل المشهد", description: "تعديل مشهد صورة موجودة باستخدام وصف نصي." },
  { value: "generate-image", label: "توليد صورة", description: "إنشاء صورة من وصف نصي دون الحاجة إلى صورة مصدر." },
  { value: "change-background", label: "استبدال الخلفية", description: "تغيير خلفية صورة موجودة وفق الوصف." },
  { value: "improve-lighting", label: "تحسين الإضاءة", description: "تحسين الظلال والإضاءة باستخدام أداة التحسين المتاحة." },
] as const;

type Action = (typeof ACTIONS)[number]["value"];

export function StarXDetails() {
  return <>
    <header className="ex-heading">
      <span>STAR X · IMAGE AI</span>
      <h1>Star X</h1>
      <p>أدوات معالجة الصور وتوليدها ضمن Bmg-Apis، من خلال واجهة API موحدة.</p>
    </header>
    <section className="ex-card" style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>Star X</h2><p style={{ margin: "6px 0" }}>معالجة الصور</p><span className="ex-status">POST · Active</span></div>
      </div>
      <p>توفر Star X أربع وظائف للصور: تعديل المشهد، توليد صورة، استبدال الخلفية، وتحسين الإضاءة باستخدام أداة الظلال المتاحة لدى المزود.</p>
      <div className="ex-model-grid">
        {ACTIONS.map((action) => <article className="ex-card" key={action.value}><h3>{action.label}</h3><p>{action.description}</p><code dir="ltr">{action.value}</code></article>)}
      </div>
      <div className="ex-facts">
        <span>المسار <b dir="ltr">{ENDPOINT}</b></span>
        <span>الطريقة <b>POST</b></span>
        <span>المزود <b>Star X</b></span>
        <span>لغة التعليمات <b>English only</b></span>
        <span>حجم الطلب الأقصى <b>1 MB</b></span>
      </div>
      <div className="ex-notice" role="note">مهم: يجب كتابة قيمة prompt باللغة الإنجليزية فقط. لا تقبل الخدمة التعليمات العربية.</div>
      <div className="ex-notice" role="note">ملاحظة تقنية: خيار تحسين الإضاءة يستخدم أداة aiShadows المتاحة من المزود؛ وليس واجهة إضاءة مستقلة موثقة.</div>
      <div className="ex-actions"><Link href="/models/star-x/test">اختبر Star X</Link><Link href="/docs">التوثيق</Link></div>
    </section>
  </>;
}

export function StarXTest() {
  const [action, setAction] = useState<Action>("generate-image");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);

  const needsImage = action !== "generate-image";
  const needsPrompt = action !== "improve-lighting";
  const selected = ACTIONS.find((item) => item.value === action)!;

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  async function run() {
    if (busy) return;
    setError("");
    if (needsImage && !/^https:\/\//i.test(imageUrl.trim())) {
      setError("أدخل رابط صورة صالحًا يبدأ بـ https://.");
      return;
    }
    if (needsPrompt && !prompt.trim()) {
      setError("اكتب وصفًا باللغة الإنجليزية قبل التشغيل.");
      return;
    }
    if (/[\u0600-\u06FF]/.test(prompt)) {
      setError("Star X تقبل التعليمات باللغة الإنجليزية فقط.");
      return;
    }

    setBusy(true);
    const started = performance.now();
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...(needsImage ? { imageUrl: imageUrl.trim() } : {}),
          ...(needsPrompt ? { prompt: prompt.trim() } : {}),
        }),
      });
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !type.startsWith("image/")) {
        let message = "تعذر تنفيذ الطلب.";
        try {
          const data = await response.json();
          message = String(data.error || data.message || message);
        } catch {}
        throw new Error("HTTP " + response.status + ": " + message);
      }
      const blob = await response.blob();
      const nextUrl = URL.createObjectURL(blob);
      setResultUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setElapsed(Math.round(performance.now() - started));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ غير معروف أثناء الاتصال.");
      setElapsed(Math.round(performance.now() - started));
      setResultUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <header className="ex-heading">
      <span>STAR X · LIVE API TEST</span>
      <h1>اختبار Star X</h1>
      <p>اختبر الوظائف الأربع عبر نقطة الاتصال الفعلية. تُعاد النتيجة كملف صورة.</p>
    </header>
    <div className="ex-playground-grid ex-model-test">
      <section className="ex-card" style={{ display: "grid", gap: 14 }}>
        <div className="ex-test-model-head"><b>Star X</b><small>Image AI</small></div>
        <label>الوظيفة
          <select value={action} onChange={(event) => { setAction(event.target.value as Action); setError(""); }}>
            {ACTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </label>
        <p className="ex-muted">{selected.description}</p>
        {needsImage && <label>رابط الصورة (HTTPS)
          <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.jpg" dir="ltr" />
        </label>}
        {needsPrompt && <label>وصف باللغة الإنجليزية
          <textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the changes you want..." dir="ltr" />
        </label>}
        <p className="ex-muted">هذا الاختبار يعمل من الموقع الرسمي دون إدخال مفتاح API. يلزم مفتاح صالح عند استخدام نقطة الاتصال من تطبيق أو عميل خارجي.</p>
        {error && <p className="ex-error" role="alert">{error}</p>}
        <button className="ex-primary ex-run-test" disabled={busy} onClick={run}>{busy ? "جارٍ تنفيذ الطلب…" : "تشغيل Star X"}</button>
      </section>
      <section className="ex-card">
        <div className="ex-card-head"><h3>نتيجة الاختبار</h3>{elapsed !== null && <small>{elapsed} ms</small>}</div>
        {resultUrl ? <div style={{ display: "grid", gap: 12 }}><p className="ex-good">تم تنفيذ الطلب واستلام صورة.</p><img src={resultUrl} alt="Star X result" style={{ width: "100%", height: "auto", borderRadius: 12 }} /><a className="ex-primary" href={resultUrl} download="star-x-result.png">حفظ الصورة الناتجة</a></div> : <div className="ex-test-empty"><span>—</span><p>اختر الوظيفة وأدخل البيانات المطلوبة ثم شغّل الاختبار.</p></div>}
      </section>
    </div>
    <div className="ex-test-back"><Link href="/models/star-x">العودة إلى تفاصيل Star X</Link><Link href="/models">كل الخدمات</Link></div>
  </>;
}
