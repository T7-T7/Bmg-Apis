"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import styles from "./notifications-center.module.css";
type Notification={id:string;title:string;body:string;type:"info"|"warning"|"critical";read_at:string|null;created_at:string;metadata:Record<string,unknown>};
export default function NotificationsCenter(){
 const router=useRouter();
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [user,setUser]=useState<string|null>(null);
 const [rows,setRows]=useState<Notification[]>([]);
 const [filter,setFilter]=useState("all");
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  if(!db||!user)return;
  setLoading(true);setError("");
  const {data,error}=await db.from("user_notifications").select("id,title,body,type,read_at,created_at,metadata").eq("user_id",user).order("created_at",{ascending:false}).limit(200);
  if(error){setError("تعذر تحميل الإشعارات: "+error.message);setRows([])}else setRows((data||[]) as Notification[]);
  setLoading(false);
 },[db,user]);
 useEffect(()=>{let alive=true;if(!db){setLoading(false);setError("إعدادات الاتصال غير مكتملة.");return}db.auth.getUser().then(({data,error})=>{if(!alive)return;if(error||!data.user){router.replace("/login");return}setUser(data.user.id)});return()=>{alive=false}},[db,router]);
 useEffect(()=>{if(user)void load()},[user,load]);
 const visible=useMemo(()=>rows.filter(r=>(filter==="all"||(filter==="unread"?!r.read_at:r.type===filter))&&[r.title,r.body,r.type].some(v=>String(v||"").toLowerCase().includes(query.toLowerCase()))),[rows,filter,query]);
 const unread=rows.filter(r=>!r.read_at).length;
 const markRead=async(row:Notification)=>{if(!db||!user||row.read_at)return;const now=new Date().toISOString();const {error}=await db.from("user_notifications").update({read_at:now}).eq("id",row.id).eq("user_id",user);if(error)setError(error.message);else setRows(old=>old.map(x=>x.id===row.id?{...x,read_at:now}:x))};
 const markAll=async()=>{if(!db||!user||!unread)return;const now=new Date().toISOString();const {error}=await db.from("user_notifications").update({read_at:now}).eq("user_id",user).is("read_at",null);if(error)setError(error.message);else setRows(old=>old.map(x=>({...x,read_at:x.read_at||now})))};
 const remove=async(row:Notification)=>{if(!db||!user||!confirm("حذف هذا الإشعار؟"))return;const {error}=await db.from("user_notifications").delete().eq("id",row.id).eq("user_id",user);if(error)setError(error.message);else setRows(old=>old.filter(x=>x.id!==row.id))};
 return <section className={styles.page} dir="rtl">
  <header className={styles.header}><div><span>ACCOUNT CENTER</span><h1>مركز الإشعارات</h1><p>إشعارات الحساب والتنبيهات الأمنية وتحديثات المنصة.</p></div><button onClick={()=>void load()}>تحديث</button></header>
  <div className={styles.toolbar}><div className={styles.filters}>{[["all","الكل"],["unread","غير مقروء"],["info","معلوماتي"],["warning","تحذيري"],["critical","حرج"]].map(([v,l])=><button key={v} className={filter===v?styles.selected:""} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className={styles.search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في الإشعارات"/><button onClick={()=>void markAll()} disabled={!unread}>تحديد الكل كمقروء</button></div></div>
  <div className={styles.count}>لديك {unread} إشعار غير مقروء من أصل {rows.length}</div>
  {error&&<div className={styles.error}>{error}</div>}
  {loading?<div className={styles.empty}>جارٍ تحميل الإشعارات…</div>:visible.length?<div className={styles.list}>{visible.map(row=><article key={row.id} className={row.read_at?styles.read:styles.unread}><div className={styles.top}><span className={styles[row.type]}>{row.type==="critical"?"حرج":row.type==="warning"?"تحذير":"معلومات"}</span><time>{new Date(row.created_at).toLocaleString("ar-EG")}</time></div><h2>{row.title}</h2><p>{row.body}</p><div className={styles.actions}>{!row.read_at&&<button onClick={()=>void markRead(row)}>تحديد كمقروء</button>}<button onClick={()=>void remove(row)}>حذف</button></div></article>)}</div>:<div className={styles.empty}>لا توجد إشعارات مطابقة.</div>}
 </section>;
}
