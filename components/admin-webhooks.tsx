"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./admin-webhooks.module.css";

type Webhook = {
  id: string;
  name: string;
  target_url: string;
  event_types: string[];
  enabled: boolean;
  created_at: string;
  last_delivery_at: string | null;
  last_success_at: string | null;
};

type Delivery = {
  id: string;
  webhook_id: string;
  event_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  response_status: number | null;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
};

const EVENTS = [
  { id: "incident.created", label: "إنشاء حادثة" },
  { id: "incident.updated", label: "تحديث حادثة" },
  { id: "incident.resolved", label: "حل حادثة" },
  { id: "service.created", label: "إضافة خدمة" },
  { id: "service.updated", label: "تحديث خدمة" },
  { id: "service.archived", label: "أرشفة خدمة" },
  { id: "maintenance.changed", label: "تغيير الصيانة" },
];

const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("ar-EG") : "—";

const statusLabel: Record<string, string> = {
  pending: "في الانتظار",
  processing: "قيد الإرسال",
  succeeded: "تم التسليم",
  failed: "فشل نهائي",
};

export default function AdminWebhooks() {
  const [supabase] = useState(() => {
    try { return getSupabaseBrowserClient(); } catch { return null; }
  });
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["incident.created", "incident.updated", "incident.resolved"]);
  const [createdSecret, setCreatedSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError("تعذر الاتصال بقاعدة البيانات.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const [webhookResult, deliveryResult] = await Promise.all([
      supabase.from("api_webhooks")
        .select("id,name,target_url,event_types,enabled,created_at,last_delivery_at,last_success_at")
        .order("created_at", { ascending: false }),
      supabase.from("api_webhook_deliveries")
        .select("id,webhook_id,event_type,status,attempts,max_attempts,response_status,last_error,delivered_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (webhookResult.error || deliveryResult.error) {
      setError(webhookResult.error?.message || deliveryResult.error?.message || "تعذر تحميل بيانات Webhooks.");
    } else {
      setWebhooks((webhookResult.data ?? []) as Webhook[]);
      setDeliveries((deliveryResult.data ?? []) as Delivery[]);
      setError("");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const toggleEvent = (event: string) => {
    setEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event]
    );
  };

  const createWebhook = async () => {
    if (!supabase || busy) return;
    setError("");
    setNotice("");
    let parsed: URL;
    try {
      parsed = new URL(targetUrl.trim());
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        throw new Error("استخدم رابط HTTPS عام بدون بيانات دخول داخل الرابط.");
      }
    } catch {
      setError("أدخل رابط HTTPS صحيحًا لنقطة الاستقبال.");
      return;
    }
    if (name.trim().length < 2 || events.length === 0) {
      setError("أدخل اسمًا واختر حدثًا واحدًا على الأقل.");
      return;
    }

    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    setBusy(true);
    try {
      const { error: createError } = await supabase.rpc("bmg_admin_create_webhook", {
        p_name: name.trim(),
        p_target_url: parsed.toString(),
        p_event_types: events,
        p_secret: secret,
      });
      if (createError) throw createError;
      setCreatedSecret(secret);
      setName("");
      setTargetUrl("");
      setNotice("تم إنشاء Webhook. انسخ مفتاح التوقيع الآن؛ لن يمكن عرضه مرة أخرى.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء Webhook.");
    } finally {
      setBusy(false);
    }
  };

  const toggleWebhook = async (item: Webhook) => {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const enabled = !item.enabled;
      const { error: updateError } = await supabase.from("api_webhooks")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (updateError) throw updateError;
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        actor_id: authData.user?.id ?? null,
        action: enabled ? "webhook.enable" : "webhook.disable",
        entity_type: "api_webhook",
        entity_id: item.id,
        details: { name: item.name, enabled },
      });
      setNotice(enabled ? "تم تفعيل Webhook." : "تم إيقاف Webhook.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث Webhook.");
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setNotice("تم نسخ مفتاح التوقيع.");
    } catch {
      setError("تعذر النسخ تلقائيًا. حدد المفتاح وانسخه يدويًا.");
    }
  };

  const copyDeliveryFormat = async () => {
    const text = "X-NOX-Event: event type\nX-NOX-Delivery: delivery UUID\nX-NOX-Timestamp: Unix timestamp\nX-NOX-Signature: sha256=HMAC_SHA256(secret, timestamp + '.' + raw_request_body)";
    try {
      await navigator.clipboard.writeText(text);
      setNotice("تم نسخ صيغة التحقق من التوقيع.");
    } catch {
      setError("تعذر نسخ الصيغة.");
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>INTEGRATIONS</span>
          <h2>Webhook Manager</h2>
          <p>استقبال أحداث المنصة على خدماتك الخارجية مع توقيع HMAC ومحاولات إعادة تلقائية.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || busy}>تحديث البيانات</button>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {notice && <div className={styles.notice} role="status">{notice}</div>}

      {createdSecret && (
        <section className={styles.secretBox}>
          <div>
            <strong>مفتاح التوقيع — يظهر مرة واحدة</strong>
            <p>احتفظ به في إعدادات خادمك. لا تشاركه ولا تضعه في الواجهة الأمامية.</p>
            <code dir="ltr">{createdSecret}</code>
          </div>
          <button type="button" onClick={() => void copySecret()}>نسخ المفتاح</button>
          <button type="button" className={styles.quiet} onClick={() => setCreatedSecret("")}>إخفاء</button>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div><h3>إضافة Webhook</h3><p>يتم إنشاء سر عشوائي وتخزينه مشفرًا في Supabase Vault.</p></div>
        </div>
        <div className={styles.formGrid}>
          <label>اسم نقطة الاستقبال
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="مثال: مراقبة الخدمة"/>
          </label>
          <label>رابط HTTPS
            <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} dir="ltr" placeholder="https://example.com/webhooks/nox"/>
          </label>
        </div>
        <fieldset className={styles.events}>
          <legend>الأحداث التي تريد استقبالها</legend>
          <div className={styles.eventGrid}>
            {EVENTS.map((event) => (
              <label key={event.id}>
                <input type="checkbox" checked={events.includes(event.id)} onChange={() => toggleEvent(event.id)}/>
                <span>{event.label}</span>
                <small dir="ltr">{event.id}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.actions}>
          <button type="button" onClick={() => void createWebhook()} disabled={busy || !supabase}>
            {busy ? "جارٍ الحفظ..." : "إنشاء Webhook"}
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div><h3>نقاط الاستقبال</h3><p>{webhooks.length} نقطة استقبال مسجلة</p></div>
        </div>
        {loading ? <p className={styles.empty}>جارٍ تحميل البيانات...</p> : webhooks.length === 0 ? (
          <p className={styles.empty}>لا توجد Webhooks بعد.</p>
        ) : (
          <div className={styles.webhookList}>
            {webhooks.map((item) => (
              <article className={styles.webhook} key={item.id}>
                <div className={styles.webhookMain}>
                  <div className={styles.nameLine}>
                    <strong>{item.name}</strong>
                    <span className={item.enabled ? styles.active : styles.disabled}>{item.enabled ? "مفعّل" : "متوقف"}</span>
                  </div>
                  <code dir="ltr">{item.target_url}</code>
                  <div className={styles.tags}>
                    {item.event_types.map((event) => <span key={event} dir="ltr">{event}</span>)}
                  </div>
                  <small>آخر محاولة: {date(item.last_delivery_at)} · آخر تسليم ناجح: {date(item.last_success_at)}</small>
                </div>
                <button type="button" className={styles.quiet} disabled={busy} onClick={() => void toggleWebhook(item)}>
                  {item.enabled ? "إيقاف" : "تفعيل"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div><h3>سجل التسليم</h3><p>آخر 50 محاولة، مع إعادة تلقائية بتأخير تصاعدي حتى 8 محاولات.</p></div>
          <button type="button" className={styles.quiet} onClick={() => void copyDeliveryFormat()}>نسخ صيغة التوقيع</button>
        </div>
        {deliveries.length === 0 ? <p className={styles.empty}>لا توجد محاولات تسليم حتى الآن.</p> : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>الحدث</th><th>الحالة</th><th>المحاولات</th><th>HTTP</th><th>آخر خطأ</th><th>التاريخ</th></tr></thead>
              <tbody>
                {deliveries.map((item) => (
                  <tr key={item.id}>
                    <td dir="ltr">{item.event_type}</td>
                    <td><span className={item.status === "succeeded" ? styles.active : item.status === "failed" ? styles.failed : styles.waiting}>{statusLabel[item.status] || item.status}</span></td>
                    <td>{item.attempts} / {item.max_attempts}</td>
                    <td>{item.response_status ?? "—"}</td>
                    <td className={styles.errorCell}>{item.last_error || "—"}</td>
                    <td>{date(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.footnote}>التوقيع يُحسب على النص الخام للطلب: HMAC-SHA256(secret, timestamp + "." + rawBody). يجب على خادمك التحقق من التوقيع والوقت ومعرّف التسليم لمنع إعادة التشغيل.</p>
    </div>
  );
}
