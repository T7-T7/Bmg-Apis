"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import type {Json} from "@/lib/supabase/database.types";
import styles from "./notifications-center.module.css";

type Notification={id:string;title:string;body:string;type:"info"|"warning"|"critical";read_at:string|null;created_at:string;metadata:Json};
type Invitation={id:string;organization_name:string;project_id:string|null;role:"admin"|"developer"|"viewer";expires_at:string;created_at:string};

export default function NotificationsCenter(){
 const router=useRouter();
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const client=db as any;
 const [user,setUser]=useState<string|null>(null);
 const [rows,setRows]=useState<Notification[]>([]);
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [filter,setFilter]=useState("all");
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [busyInvitation,setBusyInvitation]=useState("");
 const load=useCallback(async()=>{
  if(!db||!user)return;
  setLoading(true);setError("");
  const [{data:notifications,error:notificationError},{data:invites,error:invitationError}]=await Promise.all([
   db.from("user_notifications").select("id,title,body,type,read_at,created_at,metadata").eq("user_id",user).order("created_at",{ascending:false}).limit(200),
   client.from("organization_invitations").select("id,organization_name,project_id,role,expires_at,created_at").eq("recipient_user_id",user).is("accepted_at",null).is("declined_at",null).is("revoked_at",null).order("created_at",{ascending:false}).limit(50)
  ]);
  if(notificationError){setError("تعذر تحميل الإشعارات: "+notificationError.message);setRows([])}else setRows((notifications||[]) as Notification[]);
  if(invitationError){setError(current=>current?current+" · تعذر تحميل الدعوات: "+invitationError.message:"تعذر تحميل الدعوات: "+invitationError.message);setInvitations([])}else setInvitations((invites||[]) as Invitation[]);
  setLoading(false);
 },[db,user]);
 useEffect(()=>{let alive=true;if(!db){setLoading(false);setError("إعدادات الاتصال غير مكتملة.");return}db.auth.getUser().then(({data,error})=>{if(!alive)return;if(error||!data.user){router.replace("/login");return}setUser(data.user.id)});return()=>{alive=false}},[db,router]);
 useEffect(()=>{if(user)void load()},[user,load]);
 const visible=useMemo(()=>rows.filter(r=>(filter==="all"||(filter==="unread"?!r.read_at:r.type===filter))&&[r.title,r.body,r.type].some(v=>String(v||"").toLowerCase().includes(query.toLowerCase()))),[rows,filter,query]);
 const unread=rows.filter(r=>!r.read_at).length;
 const markRead=async(row:Notification)=>{if(!db||!user||row.read_at)return;const now=new Date().toISOString();const {error}=await db.from("user_notifications").update({read_at:now}).eq("id",row.id).eq("user_id",user);if(error)setError(error.message);else setRows(old=>old.map(x=>x.id===row.id?{...x,read_at:now}:x))};
 const markAll=async()=>{if(!db||!user||!unread)return;const now=new Date().toISOString();const {error}=await db.from("user_notifications").update({read_at:now}).eq("user_id",user).is("read_at",null);if(error)setError(error.message);else setRows(old=>old.map(x=>({...x,read_at:x.read_at||now})))};
 const remove=async(row:Notification)=>{if(!db||!user||!confirm("حذف هذا الإشعار؟"))return;const {error}=await db.from("user_notifications").delete().eq("id",row.id).eq("user_id",user);if(error)setError(error.message);else setRows(old=>old.filter(x=>x.id!==row.id))};
 const respondToInvitation=async(invitation:Invitation,accept:boolean)=>{if(!db)return;setBusyInvitation(invitation.id);setError("");const {error}=await client.rpc("bmg_respond_to_organization_invitation",{p_invitation_id:invitation.id,p_accept:accept});if(error)setError(error.message.includes("expired")?"انتهت صلاحية هذه الدعوة.":error.message.includes("no longer pending")?"لم تعد هذه الدعوة متاحة.": "تعذر معالجة الدعوة: "+error.message);else await load();setBusyInvitation("")};
 const roleLabel=(role:Invitation["role"])=>role==="admin"?"مدير المؤسسة":role==="developer"?"مطور":"مشاهد";
 return <section className={styles.page} dir="rtl">
  <header className={styles.header}><div><span>ACCOUNT INBOX</span><h1>البريد الوارد</h1><p>إشعارات الحساب والمنصة والتنبيهات الأمنية ودعوات المؤسسات والمشاريع.</p></div><button onClick={()=>void load()} disabled={loading}>تحديث</button></header>
  {error&&<div className={styles.error}>{error}</div>}
  {invitations.length>0&&<section className={styles.invitationSection}><div className={styles.sectionHeading}><div><h2>دعوات واردة</h2><p>راجع الدعوات قبل الانضمام إلى مساحة عمل أو مشروع.</p></div><span>{invitations.length} دعوة</span></div><div className={styles.invitationList}>{invitations.map(invite=><article key={invite.id} className={styles.invitationCard}><div className={styles.invitationMeta}><span>دعوة مؤسسة</span><time>{new Date(invite.created_at).toLocaleString("ar-EG")}</time></div><h3>{invite.organization_name}</h3><p>الدور المقترح: <b>{roleLabel(invite.role)}</b>{invite.project_id?" · الوصول إلى مشروع محدد":" · الوصول إلى مساحة المؤسسة"}</p><small>تنتهي الدعوة: {new Date(invite.expires_at).toLocaleDateString("ar-EG")}</small><div className={styles.invitationActions}><button className={styles.decline} disabled={busyInvitation===invite.id} onClick={()=>void respondToInvitation(invite,false)}>رفض الدعوة</button><button className={styles.accept} disabled={busyInvitation===invite.id} onClick={()=>void respondToInvitation(invite,true)}>{busyInvitation===invite.id?"جارٍ التنفيذ…":"قبول الدعوة"}</button></div></article>)}</div></section>}
  <div className={styles.sectionHeading}><div><h2>إشعارات المنصة</h2><p>التنبيهات والتحديثات المرتبطة بحسابك.</p></div><span>{unread} غير مقروء</span></div>
  <div className={styles.toolbar}><div className={styles.filters}>{[["all","الكل"],["unread","غير مقروء"],["info","معلوماتي"],["warning","تحذيري"],["critical","حرج"]].map(([v,l])=><button key={v} className={filter===v?styles.selected:""} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className={styles.search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في الإشعارات"/><button onClick={()=>void markAll()} disabled={!unread}>تحديد الكل كمقروء</button></div></div>
  <div className={styles.count}>لديك {unread} إشعار غير مقروء من أصل {rows.length}</div>
  {loading?<div className={styles.skeletonList} role="status" aria-label="جارٍ تحميل البريد الوارد" aria-busy="true">{[1,2,3].map(item=><div className={styles.skeletonCard} key={item}><i/><b/><span/><span/></div>)}</div>:visible.length?<div className={styles.list}>{visible.map(row=><article key={row.id} className={row.read_at?styles.read:styles.unread}><div className={styles.top}><span className={styles[row.type]}>{row.type==="critical"?"حرج":row.type==="warning"?"تحذير":"معلومات"}</span><time>{new Date(row.created_at).toLocaleString("ar-EG")}</time></div><h2>{row.title}</h2><p>{row.body}</p><div className={styles.actions}>{!row.read_at&&<button onClick={()=>void markRead(row)}>تحديد كمقروء</button>}<button onClick={()=>void remove(row)}>حذف</button></div></article>)}</div>:<div className={styles.empty}>لا توجد إشعارات مطابقة.</div>}
 </section>;
}
