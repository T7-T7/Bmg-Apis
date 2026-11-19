"use client";

import { useState } from "react";
import { ArrowUpLeft, Copy, LoaderCircle, Play, RotateCcw, Sparkles } from "lucide-react";

const MAX_CHARS = 30_000;

export default function GeminiTester() {
  const [prompt, setPrompt] = useState("");
  const [instruction, setInstruction] = useState("أجب باللغة العربية بوضوح ودقة.");
  const [sessionId, setSessionId] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!prompt.trim() || prompt.length > MAX_CHARS || loading) return;
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const result = await fetch("/api/v1/ai/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, instruction, sessionId: sessionId || undefined }),
      });
      const data = await result.json();
      if (!result.ok || !data.success) throw new Error(data.error || `HTTP ${result.status}`);
      setResponse(data.response || "");
      if (data.sessionId) setSessionId(data.sessionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ الطلب.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="gemini-tester" id="try-api">
      <div className="tester-heading"><div><span className="tester-icon"><Sparkles size={18} /></span><div><h2>جرّب عقل مباشرة</h2><p>اختبر الخدمة من المتصفح قبل دمجها في مشروعك.</p></div></div><span className="tester-limit">30,000 حرف</span></div>
      <label className="tester-label" htmlFor="gemini-prompt">رسالة المستخدم</label>
      <textarea id="gemini-prompt" className="tester-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={MAX_CHARS} placeholder="اكتب سؤالك هنا..." />
      <div className="tester-meta"><span>{prompt.length.toLocaleString("en-US")} / 30,000</span><span>POST · JSON</span></div>
      <label className="tester-label" htmlFor="gemini-instruction">تعليمات إضافية (اختياري)</label>
      <input id="gemini-instruction" className="tester-instruction" value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="مثال: أجب باختصار..." />
      <div className="tester-actions"><button className="button-primary" type="button" onClick={run} disabled={!prompt.trim() || prompt.length > MAX_CHARS || loading}>{loading ? <LoaderCircle size={16} className="spin" /> : <Play size={15} />} {loading ? "جارٍ التنفيذ..." : "إرسال الطلب"}</button><button className="button-secondary" type="button" onClick={() => { setPrompt(""); setResponse(""); setError(""); setSessionId(""); }}><RotateCcw size={14} /> مسح التجربة</button></div>
      {error && <div className="tester-error">{error}</div>}
      {response && <div className="tester-result"><div className="tester-result-head"><strong>استجابة عقل</strong><button type="button" onClick={() => navigator.clipboard.writeText(response)}><Copy size={13} /> نسخ الرد</button></div><pre>{response}</pre></div>}
      {sessionId && <div className="tester-session"><span>تم حفظ sessionId لمتابعة المحادثة في الطلب التالي.</span><button type="button" onClick={() => navigator.clipboard.writeText(sessionId)}><Copy size={13} /> نسخ Session ID</button></div>}
    </section>
  );
}
