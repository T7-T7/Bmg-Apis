"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, ArrowDownToLine, Check, Copy, Image as ImageIcon, LoaderCircle, Play, RefreshCw, Sparkles, Terminal, WalletCards } from "lucide-react";

type ApiId = "gemini" | "image" | "currency";
type CodeLang = "curl" | "js" | "python";

const apiOptions: { id: ApiId; name: string; method: string; path: string; description: string; live: boolean }[] = [
  { id: "gemini", name: "Gemini Text", method: "POST", path: "/api/v1/ai/gemini", description: "توليد النصوص والمحادثة مع تعليمات اختيارية.", live: true },
  { id: "image", name: "AI Image", method: "POST", path: "/api/v1/ai/image", description: "معاينة شكل واجهة توليد الصور — لم يتم ربط محرك توليد بعد.", live: false },
  { id: "currency", name: "Currency Rate", method: "GET", path: "/api/v1/currency/rate", description: "معاينة استجابة أسعار العملات — لم يتم ربط مصدر أسعار بعد.", live: false },
];

const reveal = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: .48, ease: "easeOut" as const } } };

function highlightJson(value: string) {
  return value.split(/("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?)/g).map((part, index) => {
    let kind = "json-punctuation";
    if (/^".*"$/.test(part) && /:$/.test(part)) kind = "json-key";
    else if (/^".*"$/.test(part)) kind = "json-string";
    else if (/^(true|false|null)$/.test(part)) kind = "json-boolean";
    else if (/^-?\d/.test(part)) kind = "json-number";
    return <span className={kind} key={index}>{part}</span>;
  });
}

export default function PlaygroundPage() {
  const [selected, setSelected] = useState<ApiId>("gemini");
  const [prompt, setPrompt] = useState("اشرح مفهوم REST API بمثال بسيط.");
  const [apiKey, setApiKey] = useState("");
  const [language, setLanguage] = useState<CodeLang>("js");
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const current = apiOptions.find(item => item.id === selected)!;

  const snippets = useMemo(() => {
    const url = "https://bmg-apis.vercel.app" + current.path;
    const body = selected === "gemini" ? JSON.stringify({ prompt }, null, 2) : selected === "image" ? JSON.stringify({ prompt }, null, 2) : "";
    return {
      curl: selected === "currency"
        ? "curl -X GET '" + url + "?base=USD&target=EUR'"
        : "curl -X POST '" + url + "' \\\\\n  -H 'Content-Type: application/json' \\\\\n  -H 'Authorization: Bearer YOUR_NOX_API_KEY' \\\\\n  -d '" + JSON.stringify(selected === "gemini" ? { prompt } : { prompt }).replaceAll("'", "'\\\\''") + "'",
      js: selected === "currency"
        ? "const response = await fetch('" + url + "?base=USD&target=EUR');\nconst data = await response.json();\nconsole.log(data);"
        : "const response = await fetch('" + url + "', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    Authorization: 'Bearer ' + process.env.NOX_API_KEY\n  },\n  body: JSON.stringify(" + body + ")\n});\nconst data = await response.json();\nconsole.log(data);",
      python: selected === "currency"
        ? "import requests\nresponse = requests.get('" + url + "', params={'base': 'USD', 'target': 'EUR'})\nprint(response.json())"
        : "import os, requests\nresponse = requests.post(\n    '" + url + "',\n    headers={'Authorization': 'Bearer ' + os.environ['NOX_API_KEY']},\n    json=" + body.replaceAll("\n", "\n    ") + "\n)\nprint(response.json())",
    };
  }, [current.path, prompt, selected]);

  async function run() {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError("");
    setResponse(null);
    try {
      if (selected === "gemini" && apiKey.trim()) {
        const result = await fetch("/api/v1/ai/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey.trim() },
          body: JSON.stringify({ prompt }),
        });
        const data = await result.json();
        if (!result.ok || !data.success) throw new Error(data.error || "HTTP " + result.status);
        setResponse({ ...data, _mode: "live", _httpStatus: result.status });
      } else {
        await new Promise(resolve => window.setTimeout(resolve, 450));
        if (selected === "gemini") setResponse({ success: true, demo: true, provider: "NOX Playground", response: "هذه استجابة تجريبية توضح شكل المخرجات فقط. أدخل مفتاح Nox API صالحًا لتشغيل Gemini الفعلي.", prompt, _mode: "mock", _httpStatus: 200 });
        if (selected === "image") setResponse({ success: true, demo: true, status: "preview_only", prompt, image: null, message: "واجهة توليد الصور غير متصلة حاليًا. هذه بيانات توضيحية وليست صورة مولدة.", _mode: "mock", _httpStatus: 200 });
        if (selected === "currency") setResponse({ success: true, demo: true, base: "USD", target: "EUR", rate: 0.92, source: "sample_data", updatedAt: new Date().toISOString(), message: "سعر توضيحي غير صالح للاستخدام المالي.", _mode: "mock", _httpStatus: 200 });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ الطلب.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError("تعذر النسخ من هذا المتصفح."); }
  }

  return (
    <div className="nox-playground">
      <motion.section className="page-heading" variants={reveal} initial="hidden" animate="visible">
        <div><div className="eyebrow"><Terminal size={14} /> NOX API LAB</div><h1>Playground</h1><p>اختبر الطلبات، عدّل المدخلات، وعاين بنية JSON قبل دمج الواجهة في مشروعك.</p></div>
        <span className="playground-open-badge"><span /> Guest access</span>
      </motion.section>

      <motion.section className="playground-layout" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <aside className="playground-api-list glass-panel">
          <div className="playground-panel-title"><strong>اختر API</strong><small>3 endpoints</small></div>
          {apiOptions.map(api => <motion.button key={api.id} type="button" className={"playground-api-option " + (selected === api.id ? "active" : "")} onClick={() => { setSelected(api.id); setResponse(null); setError(""); }} whileTap={{ scale: .97 }}>
            <span className="playground-api-icon">{api.id === "gemini" ? <Sparkles size={17} /> : api.id === "image" ? <ImageIcon size={17} /> : <WalletCards size={17} />}</span>
            <span className="playground-api-info"><strong>{api.name}</strong><small dir="ltr">{api.method} {api.path}</small></span>
            <i className={api.live ? "api-live-dot" : "api-preview-dot"} />
          </motion.button>)}
          <div className="playground-list-note">النقطة المتصلة فعليًا: Gemini. الباقي يعرض بيانات محاكاة فقط.</div>
        </aside>

        <div className="playground-workspace">
          <section className="playground-editor glass-panel">
            <div className="playground-editor-head"><div><span className={"method method-" + current.method.toLowerCase()}>{current.method}</span><code dir="ltr">{current.path}</code></div><span className={current.live ? "service-state ready" : "service-state"}><i />{current.live ? "Live API" : "Preview"}</span></div>
            <p className="playground-api-description">{current.description}</p>
            {selected === "gemini" && <label className="playground-field"><span>مفتاح Nox API <small>اختياري للعرض التجريبي</small></span><input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="nox_live_..." autoComplete="off" dir="ltr" /></label>}
            <label className="playground-field"><span>{selected === "currency" ? "ملاحظة الطلب" : "Prompt"}</span><textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={5} placeholder="اكتب محتوى الطلب..." /></label>
            <div className="playground-editor-actions"><motion.button type="button" className="button-primary" onClick={run} disabled={busy || !prompt.trim()} whileTap={{ scale: .97 }}>{busy ? <LoaderCircle size={16} className="spin" /> : <Play size={15} />}{busy ? "جارٍ التنفيذ..." : "Run request"}</motion.button><motion.button type="button" className="button-secondary" onClick={() => { setPrompt(""); setResponse(null); setError(""); }} whileTap={{ scale: .97 }}><RefreshCw size={14} /> مسح</motion.button></div>
            <p className="playground-security-note">المفتاح لا يُحفظ في localStorage ولا يُرسل إلا إلى نقطة Gemini على نفس الموقع.</p>
          </section>

          <section className="playground-response glass-panel">
            <div className="playground-panel-title"><div><strong>Response</strong><small>JSON output</small></div><span className="response-format-tag">application/json</span></div>
            {busy ? <div className="playground-empty"><LoaderCircle size={22} className="spin" /><span>جارٍ انتظار الاستجابة...</span></div> : response ? <div className="playground-json"><div className="playground-json-toolbar"><span className={(response._mode === "live") ? "live-response" : "mock-response"}>{response._mode === "live" ? "LIVE RESPONSE" : "MOCK RESPONSE"}</span><span>HTTP {String(response._httpStatus || 200)}</span><button type="button" onClick={() => copy(JSON.stringify(response, null, 2))}><Copy size={13} /> نسخ JSON</button></div><pre dir="ltr">{highlightJson(JSON.stringify(response, null, 2))}</pre></div> : error ? <div className="playground-error">{error}</div> : <div className="playground-empty"><ArrowDownToLine size={23} /><strong>لا توجد استجابة بعد</strong><span>اختر API ثم اضغط Run request لعرض JSON هنا.</span></div>}
          </section>
        </div>
      </motion.section>

      <motion.section className="playground-code-section" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="section-heading"><div><span className="section-overline">INTEGRATION SNIPPETS</span><h2>استخدمها في مشروعك</h2><p>أمثلة قابلة للنسخ للواجهة المحددة.</p></div></div>
        <div className="playground-code-card glass-panel">
          <div className="playground-code-tabs">{(["curl", "js", "python"] as CodeLang[]).map(lang => <button type="button" key={lang} className={language === lang ? "active" : ""} onClick={() => setLanguage(lang)}>{lang === "js" ? "JavaScript" : lang === "curl" ? "cURL" : "Python"}</button>)}</div>
          <div className="playground-code-content"><pre dir="ltr">{snippets[language]}</pre><button type="button" className="playground-copy-code" onClick={() => copy(snippets[language])}>{copied ? <Check size={14} /> : <Copy size={14} />} نسخ الكود</button></div>
        </div>
        <p className="playground-code-warning">أمثلة image وcurrency توثيقية فقط حاليًا؛ لا توجد مسارات تشغيل لهذه الخدمات في الخادم حتى الآن.</p>
      </motion.section>
    </div>
  );
}
