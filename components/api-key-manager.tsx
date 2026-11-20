"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { motion } from "motion/react";

type ApiKey = { id: string; label: string; key_prefix: string; created_at: string; last_used_at: string | null; expires_at: string | null; revoked_at: string | null };

const usageExample = `const response = await fetch("https://bmg-apis-b2-902b.vercel.app/api/v1/ai/gemini", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + process.env.NOX_API_KEY
  },
  body: JSON.stringify({ prompt: "Hello" })
});
const data = await response.json();`;

function makeKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "nox_live_" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [keyVisible, setKeyVisible] = useState(true);

  async function load() {
    setBusy(true); setError("");
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("bmg_list_api_keys");
    if (rpcError) setError(rpcError.message);
    else setKeys((data ?? []) as ApiKey[]);
    setBusy(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the current user keys after mount.
  useEffect(() => { void load(); }, []);

  async function createKey() {
    setWorking(true); setError(""); setNewKey(""); setCopied(false);
    try {
      const key = makeKey();
      const { error: rpcError } = await getSupabaseBrowserClient().rpc("bmg_create_api_key", { p_key: key, p_label: label.trim() || "Default key" });
      if (rpcError) throw rpcError;
      setNewKey(key); setKeyVisible(true); setLabel(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنشاء المفتاح."); }
    finally { setWorking(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("هل تريد إلغاء هذا المفتاح؟ لن يعمل بعد ذلك.")) return;
    setWorking(true); setError("");
    const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("bmg_revoke_api_key", { p_id: id });
    if (rpcError) setError(rpcError.message);
    else if (!data) setError("لم يتم العثور على المفتاح أو أنه ملغى بالفعل.");
    await load(); setWorking(false);
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError("تعذر نسخ المفتاح. انسخه يدويًا من الحقل.");
    }
  }

  return (
    <div className="key-manager">
      <div className="key-create-row"><input value={label} onChange={e => setLabel(e.target.value)} maxLength={64} placeholder="اسم المفتاح، مثل: مشروع المتجر" /><motion.button className="button-primary" onClick={createKey} disabled={working} whileTap={{ scale: .97 }}>{working ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />} إنشاء مفتاح</motion.button></div>
      {error && <div className="auth-error">{error}</div>}
      {newKey && <div className="new-key-warning"><strong><KeyRound size={16} /> انسخ مفتاحك الآن</strong><p>لن نعرض القيمة الكاملة مرة أخرى. خزّنه في متغير بيئة خاص ولا تضعه في كود الواجهة الأمامية.</p><div className="new-key-value" dir="ltr"><code>{keyVisible ? newKey : "•".repeat(34)}</code><motion.button onClick={() => setKeyVisible(value => !value)} aria-label={keyVisible ? "إخفاء المفتاح" : "إظهار المفتاح"} whileTap={{ scale: .97 }}>{keyVisible ? "إخفاء" : "إظهار"}</motion.button><motion.button onClick={() => copy(newKey)} aria-label="نسخ المفتاح" whileTap={{ scale: .97 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</motion.button></div></div>}
      <section className="key-usage-panel"><div><strong>طريقة استخدام المفتاح</strong><p>ضع قيمة المفتاح في متغير بيئة خادمي باسم NOX_API_KEY. لا تستخدم المفتاح مباشرة في كود المتصفح.</p></div><pre dir="ltr">{usageExample}</pre></section>
      <div className="key-list-head"><strong>مفاتيحك</strong><span>{keys.length} مفتاح</span></div>
      {busy ? <div className="key-empty"><LoaderCircle className="spin" size={20} /></div> : keys.length === 0 ? <div className="key-empty"><KeyRound size={23} /><strong>لا توجد مفاتيح بعد</strong><span>أنشئ مفتاحًا لبدء استخدام خدمات Nox Apis.</span></div> : <div className="key-list">{keys.map(item => <article className="key-row" key={item.id}><div className="key-row-icon"><KeyRound size={17} /></div><div className="key-row-info"><strong>{item.label}</strong><code dir="ltr">{item.key_prefix}••••••••</code><small>أُنشئ في {new Date(item.created_at).toLocaleDateString("ar-EG")} · {item.last_used_at ? "آخر استخدام " + new Date(item.last_used_at).toLocaleString("ar-EG") : "لم يُستخدم بعد"}</small></div><span className={item.revoked_at ? "key-status revoked" : "key-status"}>{item.revoked_at ? "ملغى" : "نشط"}</span>{!item.revoked_at && <motion.button className="icon-button key-revoke" disabled={working} onClick={() => revoke(item.id)} aria-label="إلغاء المفتاح" whileTap={{ scale: .97 }}><Trash2 size={16} /></motion.button>}</article>)}</div>}
      <div className="docs-note"><ShieldCheck size={14} /> يتم حفظ بصمة SHA-256 فقط في قاعدة البيانات. لا يتم تخزين المفتاح الأصلي، ويُعرض كاملًا مرة واحدة عند إنشائه.</div>
    </div>
  );
}
