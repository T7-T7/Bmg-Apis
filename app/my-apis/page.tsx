"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpLeft, Clock3, FileCode2, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Submission = { id: string; name: string; slug: string; description: string; review_status: string; review_note: string | null; created_at: string };

export default function MyApisPage() {
  const router = useRouter();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login?next=/my-apis"); return; }
      const { data, error: queryError } = await supabase.from("api_submissions").select("id,name,slug,description,review_status,review_note,created_at").order("created_at", { ascending: false });
      if (!active) return;
      if (queryError) setError(queryError.message);
      else setItems((data ?? []) as Submission[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  return <div>
    <div className="page-heading"><div><div className="eyebrow">مساحة المطور / سجل المساهمات</div><h1>مساهماتي</h1><p>تابع الواجهات التي اقترحتها وحالة مراجعتها واعتمادها.</p></div><Link href="/create" className="button-primary"><FileCode2 size={15} /> اقتراح API</Link></div>
    {error && <div className="auth-error">{error}</div>}
    {loading ? <div className="workspace-empty">جارٍ تحميل مساهماتك...</div> : items.length === 0 ? <div className="workspace-empty"><span className="workspace-empty-icon"><Clock3 size={27} /></span><h2>لا توجد مساهمات حتى الآن</h2><p>عندما ترسل اقتراح API سيظهر هنا مع حالة المراجعة وملاحظات المشرف.</p><Link href="/create" className="button-primary">إرسال اقتراح جديد <ArrowUpLeft size={15} /></Link></div> : <div className="submission-list">{items.map(item => <article className="submission-card" key={item.id}><div className="submission-head"><div><span className="eyebrow">{item.slug}</span><h2>{item.name}</h2></div><span className={item.review_status === "approved" ? "key-status" : item.review_status === "rejected" ? "key-status revoked" : "review-pending"}>{item.review_status === "pending" ? "قيد المراجعة" : item.review_status === "approved" ? "مقبول" : item.review_status === "rejected" ? "مرفوض" : "مطلوب تعديل"}</span></div><p>{item.description}</p><small className="submission-date">{new Date(item.created_at).toLocaleString("ar-EG")}</small>{item.review_note && <div className="docs-note"><ShieldCheck size={14} /> ملاحظة المشرف: {item.review_note}</div>}</article>)}</div>}
  </div>;
}
