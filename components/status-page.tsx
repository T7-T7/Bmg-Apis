"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import styles from "./status-page.module.css";
import FounderGlobe from "./founder-globe";
type Incident={id:string;title:string;severity:string;status:string;affected_services:string[];started_at:string;resolved_at:string|null;updated_at:string;updates:{id:string;status:string|null;message:string;created_at:string}[]};
type Maintenance={id:string;service_name:string;message:string;starts_at:string|null;ends_at:string|null;updated_at:string};
const text=(v:string)=>({minor:"منخفض",major:"مرتفع",critical:"حرج",investigating:"قيد التحقيق",identified:"تم تحديد السبب",monitoring:"تحت المراقبة",resolved:"تم الحل"} as Record<string,string>)[v]||v;
const date=(v:string)=>new Date(v).toLocaleString("ar-EG");
export default function StatusPage(){
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [incidents,setIncidents]=useState<Incident[]>([]);
 const [maintenance,setMaintenance]=useState<Maintenance[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let alive=true;const load=async()=>{if(!db){setError("تعذر الاتصال بخدمة الحالة.");setLoading(false);return}const {data,error}=await db.rpc("bmg_get_public_status");if(!alive)return;if(error)setError("تعذر تحميل حالة المنصة حاليًا.");else{const payload=data as unknown as {incidents?:Incident[];maintenance?:Maintenance[]};setIncidents(payload.incidents||[]);setMaintenance(payload.maintenance||[])}setLoading(false)};void load();return()=>{alive=false}},[db]);
 return <main className={styles.page} dir="rtl">
  <header className={styles.header}><Link href="/" className={styles.brand}><b>NOX APIS</b><span>NEXUS OF XPERIENCE · PLATFORM STATUS</span></Link><Link href="/dashboard">لوحة المطور</Link></header>
  <section className={styles.hero}><span>PUBLIC STATUS PAGE</span><h1>حالة المنصة</h1><p>ملخص الحوادث والصيانة المعلنة للمستخدمين. لا تعرض هذه الصفحة تفاصيل التشخيص الداخلية.</p><div className={styles.overall}><i className={incidents.some(x=>x.severity==="critical")?"critical":incidents.length?"warning":"neutral"}/><div><b>{loading?"جارٍ التحقق…":incidents.length?"توجد حوادث مسجلة":"لا توجد حوادث معلنة"}</b><small>{maintenance.length?maintenance.length+" نافذة صيانة نشطة": "لا توجد نوافذ صيانة نشطة"}</small></div></div></section>
  <FounderGlobe/>
  {error&&<div className={styles.error}>{error}</div>}
  <section className={styles.section}><div className={styles.sectionHead}><h2>الصيانة الحالية</h2><span>{maintenance.length}</span></div>{loading?<p className={styles.empty}>جارٍ التحميل…</p>:maintenance.length?maintenance.map(m=><article className={styles.item} key={m.id}><div><b>{m.service_name}</b><p>{m.message}</p><small>آخر تحديث: {date(m.updated_at)}</small></div><span className={styles.maintenance}>صيانة</span></article>):<p className={styles.empty}>لا توجد أعمال صيانة معلنة حاليًا.</p>}</section>
  <section className={styles.section}><div className={styles.sectionHead}><h2>الحوادث والتحديثات</h2><span>{incidents.length}</span></div>{loading?<p className={styles.empty}>جارٍ التحميل…</p>:incidents.length?incidents.map(i=><article className={styles.item} key={i.id}><div><b>{i.title}</b><p>{i.affected_services.length?i.affected_services.join("، "):"تأثير عام على المنصة"}</p><small>بدأت: {date(i.started_at)} · آخر تحديث: {date(i.updated_at)}</small>{i.updates?.length>0&&<div className={styles.incidentUpdates}>{i.updates.map(u=><div key={u.id}><span>{u.status?text(u.status):"تحديث"}</span><p>{u.message}</p><small>{date(u.created_at)}</small></div>)}</div>}</div><div className={styles.tags}><span className={styles[i.severity]||styles.minor}>{text(i.severity)}</span><span>{text(i.status)}</span></div></article>):<p className={styles.empty}>لا توجد حوادث معلنة خلال الفترة المعروضة.</p>}</section>
  <footer>يتم تحديث البيانات عند نشر تحديث من فريق الإدارة.</footer>
 </main>;
}
