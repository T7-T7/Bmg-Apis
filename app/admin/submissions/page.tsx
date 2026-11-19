"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Submission = { id: string; name: string; slug: string; description: string; endpoint_url: string; http_method: string; documentation: string; review_status: string; created_at: string; user_id: string };

export default function AdminSubmissionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const supabase = getSupabaseBrowserClient();

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login?next=/admin/submissions"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") { setDenied(true); setLoading(false); return; }
    const { data, error } = await supabase.from("api_submissions").select("*").order("created_at", { ascending: false });
    if (error) setNote(error.message); else setItems((data ?? []) as Submission[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function review(item: Submission, status: "approved" | "rejected") {
    setBusy(item.id); setNote("");
    const { error } = await supabase.from("api_submissions").update({
      review_status: status, reviewer_id: (await supabase.auth.getUser()).data.user?.id,
      review_note: note || null, reviewed_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) setNote(error.message); else await load();
    setBusy("");
  }

  if (loading) return <div className="workspace-empty">جارٍ تحميل طلبات المراجعة...</div>;
  if (denied) return <div className="workspace-empty"><ShieldCheck size={28} /><h2>لا تملك صلاحية المشرف</h2><p>هذه الصفحة مخصصة لإدارة مساهمات المجتمع.</p></div>;

  return <div className="admin-page">
    <div className="page-heading"><div><div className="eyebrow">إدارة المنصة / مراجعة المجتمع</div><h1>طلبات المساهمات</h1><p>راجع بيانات الخدمة واختبارها قبل اعتمادها أو رفضها.</p></div></div>
    <div className="admin-summary"><ShieldCheck size={18} /><span>طلبات قيد المراجعة</span><strong>{items.filter(x => x.review_status === "pending").length}</strong></div>
    {note && <div className="auth-error">{note}</div>}
    {items.length === 0 ? <div className="key-empty">لا توجد مساهمات حتى الآن.</div> : <div className="submission-list">{items.map(item => <article className="submission-card" key={item.id}>
      <div className="submission-head"><div><span className="eyebrow">{item.slug}</span><h2>{item.name}</h2></div><span className={item.review_status === "approved" ? "key-status" : item.review_status === "rejected" ? "key-status revoked" : "review-pending"}>{item.review_status}</span></div>
      <p>{item.description}</p><a href={item.endpoint_url} target="_blank" rel="noreferrer" dir="ltr">{item.http_method} · {item.endpoint_url}</a>
      <pre>{item.documentation || "لا يوجد توثيق مرفق."}</pre>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة للمساهم (اختياري)" />
      {item.review_status === "pending" && <div className="submission-actions"><button className="button-primary" disabled={!!busy} onClick={() => review(item, "approved")}>{busy === item.id ? <LoaderCircle size={15} /> : <Check size={15} />} اعتماد</button><button className="button-quiet danger-button" disabled={!!busy} onClick={() => review(item, "rejected")}><X size={15} /> رفض</button></div>}
    </article>)}</div>}
  </div>;
}