"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./admin-console.module.css";

type Tab = "overview" | "analytics" | "users" | "keys" | "services" | "submissions" | "plans" | "audit" | "notifications" | "incidents" | "maintenance";
type Profile = { id:string; email:string|null; display_name:string|null; role:string; plan:string; plan_source:string; plan_expires_at:string|null; account_status:string; created_at:string };
type Service = { id:string; slug:string; name:string; description:string; category:string; endpoint_path:string; http_method:string; docs_markdown:string; status:string; source_type:string; weight:number; archived_at:string|null; current_version:number; created_at:string };
type Submission = { id:string; user_id:string; name:string; slug:string; description:string; category:string; endpoint_url:string; http_method:string; documentation:string; review_status:string; review_note:string|null; created_at:string };
type Plan = { plan:string; requests_per_minute:number; max_api_keys:number; daily_weighted_limit:number; monthly_weighted_limit:number };
type Audit = { id:number; actor_id:string|null; action:string; entity_type:string; entity_id:string|null; details:Record<string,unknown>; created_at:string };
type Incident = { id:string; title:string; description:string; severity:string; status:string; affected_services:string[]; started_at:string; resolved_at:string|null };
type Maintenance = { id:string; service_id:string|null; enabled:boolean; message:string; starts_at:string|null; ends_at:string|null };
type AdminKey = {id:string;userId:string;displayName:string|null;email:string|null;label:string;keyPrefix:string;scopes:string[];createdAt:string;lastUsedAt:string|null;expiresAt:string|null;revokedAt:string|null};
type AdminLimit = {id:boolean;requests_per_minute:number;max_api_keys:number;daily_weighted_limit:number;monthly_weighted_limit:number};
type AdminAnalytics = {periodDays:number;totals:{requests:number;weightedUsage:number;errors:number;successRate:number|null;avgLatency:number|null;measuredRequests:number};daily:{date:string;requests:number;weightedUsage:number;errors:number;avgLatency:number|null}[];services:{slug:string;name:string;requests:number;weightedUsage:number;errors:number}[];users:{userId:string;name:string;email:string|null;requests:number;weightedUsage:number;errors:number}[];statuses:{statusCode:number;requests:number}[];peakHours:{hour:number;requests:number}[];recent:{id:number;userId:string;service:string;method:string;status:number|null;latency:number|null;createdAt:string}[]};
const TABS: {id:Tab;label:string}[] = [
 {id:"overview",label:"نظرة عامة"},{id:"analytics",label:"التحليلات"},{id:"users",label:"المستخدمون"},{id:"keys",label:"مفاتيح API"},{id:"services",label:"الخدمات"},{id:"submissions",label:"طلبات الإضافة"},
 {id:"plans",label:"المستويات والحدود"},{id:"audit",label:"سجل التدقيق"},{id:"notifications",label:"الإشعارات"},{id:"incidents",label:"الحوادث"},{id:"maintenance",label:"الصيانة"}
];
const blankService = {id:"",slug:"",name:"",description:"",category:"AI",endpoint_path:"",http_method:"POST",docs_markdown:"",status:"active",source_type:"official",weight:1};
const label = (value:string) => ({basic:"Basic",pro:"Pro",premium:"Premium",user:"مستخدم",admin:"مشرف",owner:"مالك",active:"نشط",suspended:"موقوف",pending:"قيد المراجعة",approved:"مقبول",rejected:"مرفوض",changes_requested:"مطلوب تعديل",investigating:"قيد التحقيق",identified:"تم تحديد السبب",monitoring:"تحت المراقبة",resolved:"تم الحل",minor:"منخفض",major:"مرتفع",critical:"حرج"} as Record<string,string>)[value] || value;
const date = (value:string|null) => value ? new Date(value).toLocaleString("ar-EG") : "—";

export default function AdminConsole(){
 const router=useRouter();
 const [supabase]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [user,setUser]=useState<User|null>(null);
 const [role,setRole]=useState("");
 const [ready,setReady]=useState(false);
 const [tab,setTab]=useState<Tab>("overview");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [services,setServices]=useState<Service[]>([]);
 const [submissions,setSubmissions]=useState<Submission[]>([]);
 const [plans,setPlans]=useState<Plan[]>([]);
 const [audit,setAudit]=useState<Audit[]>([]);
 const [incidents,setIncidents]=useState<Incident[]>([]);
 const [maintenance,setMaintenance]=useState<Maintenance[]>([]);
 const [query,setQuery]=useState("");
 const [serviceForm,setServiceForm]=useState(blankService);
 const [showServiceForm,setShowServiceForm]=useState(false);
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [notification,setNotification]=useState({user_id:"all",title:"",body:"",type:"info"});
 const [incidentForm,setIncidentForm]=useState({title:"",description:"",severity:"minor",status:"investigating"});
 const [maintenanceForm,setMaintenanceForm]=useState({service_id:"",message:"الخدمة تحت الصيانة مؤقتاً.",enabled:true,starts_at:"",ends_at:""});
 const [analytics,setAnalytics]=useState<AdminAnalytics|null>(null);
 const [analyticsDays,setAnalyticsDays]=useState(7);
 const [analyticsService,setAnalyticsService]=useState("");
 const [analyticsUser,setAnalyticsUser]=useState("");
 const [analyticsCategory,setAnalyticsCategory]=useState("");
 const [analyticsStatus,setAnalyticsStatus]=useState("");
 const [apiKeys,setApiKeys]=useState<AdminKey[]>([]);
 const [keyQuery,setKeyQuery]=useState("");
 const [keyStatus,setKeyStatus]=useState("all");
 const [keyForm,setKeyForm]=useState<{id:string;label:string;expiresAt:string;scopes:string}>({id:"",label:"",expiresAt:"",scopes:"api:use"});
 const [adminLimit,setAdminLimit]=useState<AdminLimit|null>(null);

 const load=useCallback(async()=>{
  if(!supabase||!user)return;
  setBusy(true);setError("");
  try{
   const [p,s,sub,pl,au,inc,mw,k,al]=await Promise.all([
    supabase.from("profiles").select("id,email,display_name,role,plan,plan_source,plan_expires_at,account_status,created_at").order("created_at",{ascending:false}),
    supabase.from("api_services").select("id,slug,name,description,category,endpoint_path,http_method,docs_markdown,status,source_type,weight,archived_at,current_version,created_at").order("created_at",{ascending:false}),
    supabase.from("api_submissions").select("id,user_id,name,slug,description,category,endpoint_url,http_method,documentation,review_status,review_note,created_at").order("created_at",{ascending:false}),
    supabase.from("api_plan_limits").select("plan,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit").order("plan"),
    supabase.from("audit_logs").select("id,actor_id,action,entity_type,entity_id,details,created_at").order("created_at",{ascending:false}).limit(100),
    supabase.from("incidents").select("id,title,description,severity,status,affected_services,started_at,resolved_at").order("started_at",{ascending:false}),
    supabase.from("maintenance_windows").select("id,service_id,enabled,message,starts_at,ends_at").order("updated_at",{ascending:false}),
    supabase.rpc("bmg_admin_list_api_keys",{p_user_id:null,p_status:"all"}),
    supabase.from("api_admin_limits").select("id,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit").eq("id",true).maybeSingle()
   ]);
   for(const x of [p,s,sub,pl,au,inc,mw,k,al])if(x.error)throw x.error;
   setProfiles((p.data||[]) as Profile[]);setServices((s.data||[]) as Service[]);setSubmissions((sub.data||[]) as Submission[]);
   setPlans((pl.data||[]) as Plan[]);setAudit((au.data||[]) as Audit[]);setIncidents((inc.data||[]) as Incident[]);setMaintenance((mw.data||[]) as Maintenance[]);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل بيانات الإدارة.");}
  finally{setBusy(false);}
 },[supabase,user]);

 useEffect(()=>{
  let active=true;
  if(!supabase){setReady(true);setError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");return;}
  supabase.auth.getUser().then(async({data,error})=>{
   if(!active)return;
   if(error||!data.user){router.replace("/login");return;}
   setUser(data.user);
   const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",data.user.id).maybeSingle();
   if(!active)return;
   if(profileError){setError(profileError.message);setReady(true);return;}
   const currentRole=String(profile?.role||"user");setRole(currentRole);
   if(!["admin","owner"].includes(currentRole)){setReady(true);return;}
   setReady(true);
  });
  return()=>{active=false};
 },[supabase,router]);

 useEffect(()=>{if(ready&&user&&["admin","owner"].includes(role))void load()},[ready,user,role,load]);
 const filteredProfiles=useMemo(()=>profiles.filter(p=>[p.email,p.display_name,p.id,p.plan,p.role].some(v=>String(v||"").toLowerCase().includes(query.toLowerCase()))),[profiles,query]);
 const filteredServices=useMemo(()=>services.filter(s=>[s.name,s.slug,s.endpoint_path,s.category].some(v=>String(v||"").toLowerCase().includes(query.toLowerCase()))),[services,query]);
 const filteredKeys=useMemo(()=>apiKeys.filter(k=>(keyStatus==="all"||(keyStatus==="active"&&!k.revokedAt&&(!k.expiresAt||new Date(k.expiresAt)>new Date()))||(keyStatus==="revoked"&&!!k.revokedAt)||(keyStatus==="expired"&&!k.revokedAt&&!!k.expiresAt&&new Date(k.expiresAt)<=new Date()))&&[k.label,k.keyPrefix,k.email,k.displayName,k.userId,k.scopes.join(" ")].some(v=>String(v||"").toLowerCase().includes(keyQuery.toLowerCase()))),[apiKeys,keyStatus,keyQuery]);
 const loadAnalytics=useCallback(async()=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.rpc("bmg_get_admin_analytics",{p_days:analyticsDays,p_service:analyticsService||null,p_user_id:analyticsUser||null,p_category:analyticsCategory||null,p_status_code:analyticsStatus?Number(analyticsStatus):null});
   if(error)throw error;
   setAnalytics(data as unknown as AdminAnalytics);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل التحليلات.");}
  finally{setBusy(false);}
 },[supabase,analyticsDays,analyticsService,analyticsUser,analyticsCategory,analyticsStatus]);
 useEffect(()=>{if(tab==="analytics"&&ready&&user&&["admin","owner"].includes(role))void loadAnalytics()},[tab,ready,user,role,loadAnalytics]);
 const exportAnalytics=(format:"json"|"csv")=>{
  if(!analytics)return;
  const content=format==="json"?JSON.stringify(analytics,null,2):[
   "date,requests,weightedUsage,errors,avgLatency",
   ...analytics.daily.map(x=>[x.date,x.requests,x.weightedUsage,x.errors,x.avgLatency??""].join(","))
  ].join("\\n");
  const blob=new Blob([content],{type:format==="json"?"application/json;charset=utf-8":"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="bmg-analytics-"+analyticsDays+"d."+format;link.click();URL.revokeObjectURL(url);
 };
 const writeAudit=async(action:string,entityType:string,entityId:string|null,details:Record<string,unknown>={})=>{
  if(!supabase||!user)return;
  const {error}=await supabase.from("audit_logs").insert({actor_id:user.id,action,entity_type:entityType,entity_id:entityId,details:details as Json});
  if(error)throw error;
 };
 const updateProfile=async(p:Profile,field:"role"|"plan"|"account_status",value:string)=>{
  if(!supabase)return;
  const next={role:field==="role"?value:p.role,plan:field==="plan"?value:p.plan,account_status:field==="account_status"?value:p.account_status};
  setBusy(true);setError("");setNotice("");
  try{
   const {error}=await supabase.rpc("bmg_admin_update_profile",{p_user_id:p.id,p_role:next.role,p_plan:next.plan,p_plan_expires_at:p.plan_expires_at as string,p_account_status:next.account_status});
   if(error)throw error;
   setNotice("تم تحديث حساب المستخدم وتسجيل العملية في سجل التدقيق.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الحساب.");}
  finally{setBusy(false);}
 };
 const updateProfileExpiry=async(p:Profile,value:string)=>{
  if(!supabase)return;
  const expiresAt=value?new Date(value+"T23:59:59").toISOString():null;
  setBusy(true);setError("");setNotice("");
  try{
   const {error}=await supabase.rpc("bmg_admin_update_profile",{p_user_id:p.id,p_role:p.role as string,p_plan:p.plan,p_plan_expires_at:expiresAt as string,p_account_status:p.account_status});
   if(error)throw error;
   setNotice("تم تحديث تاريخ انتهاء المستوى وتطبيق مهلة السماح.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث تاريخ الانتهاء.");}
  finally{setBusy(false);}
 };
 const saveService=async()=>{
  if(!supabase||!user)return;
  const f=serviceForm;
  if(!f.name.trim()||!f.slug.trim()||!f.endpoint_path.startsWith("/")){setError("أدخل الاسم والمعرّف ومساراً يبدأ بعلامة /.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const payload={slug:f.slug.trim(),name:f.name.trim(),description:f.description.trim(),category:f.category.trim(),endpoint_path:f.endpoint_path.trim(),http_method:f.http_method,docs_markdown:f.docs_markdown,status:f.status,source_type:f.source_type,weight:Number(f.weight)||1};
   if(f.id){
    const current=services.find(s=>s.id===f.id);if(!current)throw new Error("الخدمة غير موجودة.");
    const nextVersion=(current.current_version||1)+1;
    const {error:versionError}=await supabase.from("api_service_versions").insert({service_id:f.id,version:nextVersion,snapshot:payload,change_note:"تعديل من لوحة الإدارة",created_by:user.id});
    if(versionError)throw versionError;
    const {error}=await supabase.from("api_services").update({...payload,current_version:nextVersion,updated_at:new Date().toISOString()}).eq("id",f.id);
    if(error)throw error;
    await writeAudit("service.version_publish","api_service",f.id,{version:nextVersion,slug:f.slug});
   }else{
    const {data,error}=await supabase.from("api_services").insert(payload).select("id").single();
    if(error)throw error;
    await supabase.from("api_service_versions").insert({service_id:data.id,version:1,snapshot:payload,change_note:"الإصدار الأول",created_by:user.id});
    await writeAudit("service.create","api_service",data.id,{slug:f.slug});
   }
   setShowServiceForm(false);setServiceForm(blankService);setNotice("تم حفظ الخدمة وإنشاء سجل إصدار.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الخدمة.");}
  finally{setBusy(false);}
 };
 const archiveService=async(s:Service)=>{
  if(!supabase||!confirm(s.archived_at?"استعادة الخدمة إلى الكتالوج النشط؟":"أرشفة الخدمة وإيقاف ظهورها للمستخدمين؟"))return;
  setBusy(true);
  try{
   const archived_at=s.archived_at?null:new Date().toISOString();
   const {error}=await supabase.from("api_services").update({archived_at,updated_at:new Date().toISOString()}).eq("id",s.id);
   if(error)throw error;
   await writeAudit(archived_at?"service.archive":"service.restore","api_service",s.id,{slug:s.slug});
   setNotice(archived_at?"تمت أرشفة الخدمة.":"تمت استعادة الخدمة.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تغيير حالة الأرشفة.");}
  finally{setBusy(false);}
 };
 const reviewSubmission=async(s:Submission,status:string)=>{
  if(!supabase||!user)return;
  setBusy(true);setError("");
  try{
   const note=reviewNotes[s.id]||"";
   const {error}=await supabase.from("api_submissions").update({review_status:status,review_note:note,reviewer_id:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",s.id);
   if(error)throw error;
   await writeAudit("submission.review","api_submission",s.id,{status,note});
   setNotice("تم تحديث قرار مراجعة الطلب.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر مراجعة الطلب.");}
  finally{setBusy(false);}
 };
 const savePlan=async(plan:Plan)=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   const {error}=await supabase.from("api_plan_limits").upsert({...plan,updated_by:user?.id,updated_at:new Date().toISOString()},{onConflict:"plan"});
   if(error)throw error;
   await writeAudit("plan_limits.update","api_plan_limits",plan.plan,plan as unknown as Record<string,unknown>);
   setNotice("تم حفظ حدود المستوى.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ حدود المستوى.");}
  finally{setBusy(false);}
 };
 const saveAdminLimit=async(value:AdminLimit)=>{
  if(!supabase)return;setBusy(true);setError("");
  try{const {error}=await supabase.from("api_admin_limits").upsert({...value,id:true,updated_by:user?.id,updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error;await writeAudit("admin_limits.update","api_admin_limits","true",value as unknown as Record<string,unknown>);setNotice("تم حفظ الحدود المستقلة للإدارة.");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر حفظ حدود الإدارة.")}finally{setBusy(false)}
 };
 const saveAdminKey=async()=>{
  if(!supabase)return;const scopes=Array.from(new Set(keyForm.scopes.split(",").map(x=>x.trim()).filter(Boolean)));
  if(!scopes.includes("api:use"))scopes.unshift("api:use");
  setBusy(true);setError("");
  try{const {error}=await supabase.rpc("bmg_admin_update_api_key",{p_id:keyForm.id,p_label:keyForm.label,p_expires_at:(keyForm.expiresAt?new Date(keyForm.expiresAt+"T23:59:59").toISOString():null) as string,p_scopes:scopes});if(error)throw error;setNotice("تم تحديث المفتاح وتسجيل العملية.");setKeyForm({id:"",label:"",expiresAt:"",scopes:"api:use"});await load()}catch(e){setError(e instanceof Error?e.message:"تعذر تحديث المفتاح.")}finally{setBusy(false)}
 };
 const revokeAdminKey=async(key:AdminKey)=>{
  if(!supabase||!confirm("إلغاء مفتاح "+key.label+" فورًا؟"))return;
  setBusy(true);setError("");
  try{const {data,error}=await supabase.rpc("bmg_admin_revoke_api_key",{p_id:key.id});if(error)throw error;if(!data)throw new Error("المفتاح ملغى بالفعل أو غير موجود.");setNotice("تم إلغاء المفتاح وإبلاغ صاحبه.");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر إلغاء المفتاح.")}finally{setBusy(false)}
 };
 const sendNotification=async()=>{
  if(!supabase)return;
  if(!notification.title.trim()){setError("عنوان الإشعار مطلوب.");return;}
  setBusy(true);setError("");
  try{
   const targets=notification.user_id==="all"?profiles.map(p=>p.id):[notification.user_id];
   if(!targets.length)throw new Error("لا يوجد مستخدمون لإرسال الإشعار إليهم.");
   const rows=targets.map(user_id=>({user_id,title:notification.title.trim(),body:notification.body.trim(),type:notification.type}));
   const {error}=await supabase.from("user_notifications").insert(rows);
   if(error)throw error;
   await writeAudit("notification.broadcast","user_notification",null,{recipient_count:targets.length,type:notification.type});
   setNotification({user_id:"all",title:"",body:"",type:"info"});setNotice("تم إرسال الإشعار داخل لوحة التحكم.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر إرسال الإشعار.");}
  finally{setBusy(false);}
 };
 const createIncident=async()=>{
  if(!supabase||!user||!incidentForm.title.trim())return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.from("incidents").insert({...incidentForm,created_by:user.id,affected_services:[]}).select("id").single();
   if(error)throw error;
   await writeAudit("incident.create","incident",data.id,{severity:incidentForm.severity});
   setIncidentForm({title:"",description:"",severity:"minor",status:"investigating"});setNotice("تم تسجيل الحادث.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تسجيل الحادث.");}
  finally{setBusy(false);}
 };
 const changeIncident=async(i:Incident,status:string)=>{
  if(!supabase)return;
  setBusy(true);
  try{
   const {error}=await supabase.from("incidents").update({status,resolved_at:status==="resolved"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",i.id);
   if(error)throw error;
   await writeAudit("incident.status_change","incident",i.id,{status});setNotice("تم تحديث حالة الحادث.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الحادث.");}
  finally{setBusy(false);}
 };
 const saveMaintenance=async()=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   const payload={service_id:maintenanceForm.service_id||null,message:maintenanceForm.message,enabled:maintenanceForm.enabled,starts_at:maintenanceForm.starts_at?new Date(maintenanceForm.starts_at).toISOString():null,ends_at:maintenanceForm.ends_at?new Date(maintenanceForm.ends_at).toISOString():null,updated_by:user?.id,updated_at:new Date().toISOString()};
   let previous=supabase.from("maintenance_windows").update({enabled:false,updated_at:new Date().toISOString(),updated_by:user?.id});
   previous=payload.service_id?previous.eq("service_id",payload.service_id):previous.is("service_id",null);
   const {error:disableError}=await previous;
   if(disableError)throw disableError;
   const {error}=await supabase.from("maintenance_windows").insert(payload);
   if(error)throw error;
   await writeAudit("maintenance.configure","maintenance_window",null,{service_id:payload.service_id,enabled:payload.enabled});
   setNotice("تم حفظ إعداد الصيانة.");setMaintenanceForm({service_id:"",message:"الخدمة تحت الصيانة مؤقتاً.",enabled:true,starts_at:"",ends_at:""});await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الصيانة.");}
  finally{setBusy(false);}
 };
 const markMaintenance=async(m:Maintenance)=>{
  if(!supabase)return;
  const {error}=await supabase.from("maintenance_windows").update({enabled:!m.enabled,updated_at:new Date().toISOString(),updated_by:user?.id}).eq("id",m.id);
  if(error)setError(error.message);else{await writeAudit("maintenance.toggle","maintenance_window",m.id,{enabled:!m.enabled});setNotice("تم تحديث وضع الصيانة.");await load();}
 };

 if(!ready)return <main className={styles.loading}>جارٍ التحقق من صلاحيات الإدارة…</main>;
 if(!user)return <main className={styles.loading}>جارٍ تحويلك إلى تسجيل الدخول…</main>;
 if(!["admin","owner"].includes(role))return <main className={styles.denied}><h1>لا تملك صلاحية الوصول</h1><p>هذه المنطقة مخصصة لإدارة المنصة.</p><Link href="/dashboard">العودة إلى لوحة المطور</Link></main>;

 return <main className={styles.shell} dir="rtl">
  <aside className={styles.sidebar}>
   <Link href="/dashboard" className={styles.brand}><b>BMG</b><span>CONTROL CENTER</span></Link>
   <div className={styles.sideTitle}>إدارة المنصة</div>
   <nav>{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={tab===t.id?styles.active:""}>{t.label}</button>)}</nav>
   <div className={styles.sideBottom}><span>{role==="owner"?"مالك المنصة":"مشرف المنصة"}</span><Link href="/dashboard">العودة للوحة المطور</Link></div>
  </aside>
  <section className={styles.main}>
   <header className={styles.header}><div><small>NOX APIS / ADMIN</small><h1>{TABS.find(t=>t.id===tab)?.label}</h1></div><div className={styles.headerActions}><span>{user.email}</span><button onClick={()=>void load()} disabled={busy}>تحديث البيانات</button></div></header>
   {error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}{busy&&<div className={styles.busy}>جارٍ تنفيذ العملية…</div>}
   {tab==="overview"&&<><div className={styles.stats}><article><small>المستخدمون</small><strong>{profiles.length}</strong></article><article><small>المشرفون</small><strong>{profiles.filter(p=>p.role==="admin").length}</strong></article><article><small>الخدمات النشطة</small><strong>{services.filter(s=>s.status==="active"&&!s.archived_at).length}</strong></article><article><small>طلبات قيد المراجعة</small><strong>{submissions.filter(s=>s.review_status==="pending").length}</strong></article><article><small>الحوادث المفتوحة</small><strong>{incidents.filter(i=>i.status!=="resolved").length}</strong></article><article><small>نوافذ الصيانة المفعلة</small><strong>{maintenance.filter(m=>m.enabled).length}</strong></article></div><section className={styles.panel}><h2>آخر عمليات الإدارة</h2>{audit.slice(0,8).map(a=><div className={styles.auditRow} key={a.id}><b>{a.action}</b><span>{a.entity_type} · {a.entity_id||"—"}</span><time>{date(a.created_at)}</time></div>)}{!audit.length&&<p className={styles.empty}>لا توجد عمليات مسجلة بعد.</p>}</section></>}
   {tab==="analytics"&&<section className={styles.panel}>
    <div className={styles.toolbar}><h2>تحليلات المنصة</h2><div className={styles.actions}><button onClick={()=>exportAnalytics("csv")} disabled={!analytics}>تصدير CSV</button><button onClick={()=>exportAnalytics("json")} disabled={!analytics}>تصدير JSON</button><button onClick={()=>window.print()}>تصدير PDF / طباعة</button></div></div>
    <div className={styles.formGrid}>
     <label>الفترة<select value={analyticsDays} onChange={e=>setAnalyticsDays(Number(e.target.value))}><option value="1">آخر 24 ساعة</option><option value="7">7 أيام</option><option value="30">30 يوماً</option><option value="90">90 يوماً</option></select></label>
     <label>الخدمة<select value={analyticsService} onChange={e=>setAnalyticsService(e.target.value)}><option value="">كل الخدمات</option>{services.map(x=><option key={x.id} value={x.slug}>{x.name}</option>)}</select></label>
     <label>المجال<select value={analyticsCategory} onChange={e=>setAnalyticsCategory(e.target.value)}><option value="">كل المجالات</option>{Array.from(new Set(services.map(x=>x.category))).map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label>المستخدم<select value={analyticsUser} onChange={e=>setAnalyticsUser(e.target.value)}><option value="">كل المستخدمين</option>{profiles.map(x=><option key={x.id} value={x.id}>{x.display_name||x.email||x.id}</option>)}</select></label>
     <label>HTTP Status<select value={analyticsStatus} onChange={e=>setAnalyticsStatus(e.target.value)}><option value="">كل الحالات</option>{["200","201","400","401","403","404","408","429","500","502","503","504"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <div className={styles.actions}><button className={styles.primary} onClick={()=>void loadAnalytics()} disabled={busy}>تطبيق الفلاتر</button></div>
    </div>
    {analytics&&<><div className={styles.stats}><article><small>طلبات فعلية</small><strong>{analytics.totals.requests.toLocaleString("en-US")}</strong></article><article><small>Weighted Usage</small><strong>{analytics.totals.weightedUsage.toLocaleString("en-US")}</strong></article><article><small>نسبة النجاح</small><strong>{analytics.totals.successRate===null?"—":analytics.totals.successRate+"%"}</strong></article><article><small>الأخطاء</small><strong>{analytics.totals.errors.toLocaleString("en-US")}</strong></article><article><small>متوسط الاستجابة</small><strong>{analytics.totals.avgLatency===null?"—":analytics.totals.avgLatency+" ms"}</strong></article><article><small>المستخدمون النشطون</small><strong>{analytics.users.length}</strong></article></div>
    <div className={styles.analyticsGrid}><section><h3>الاستخدام اليومي</h3>{analytics.daily.map(x=><div className={styles.barRow} key={x.date}><span>{x.date}</span><div><i style={{width:Math.max(2,analytics.daily.length?x.requests/Math.max(1,...analytics.daily.map(v=>v.requests))*100:0)+"%"}}/></div><b>{x.requests}</b></div>)}</section>
    <section><h3>توزيع الخدمات</h3>{analytics.services.map(x=><div className={styles.barRow} key={x.slug}><span>{x.name}</span><div><i style={{width:Math.max(2,x.weightedUsage/Math.max(1,...analytics.services.map(v=>v.weightedUsage))*100)+"%"}}/></div><b>{x.weightedUsage}</b></div>)}</section></div>
    <div className={styles.tableWrap}><h3>استهلاك المستخدمين</h3><table><thead><tr><th>المستخدم</th><th>الطلبات</th><th>Weighted Usage</th><th>الأخطاء</th></tr></thead><tbody>{analytics.users.map(x=><tr key={x.userId}><td><b>{x.name}</b><small>{x.email}</small></td><td>{x.requests}</td><td>{x.weightedUsage}</td><td>{x.errors}</td></tr>)}</tbody></table></div>
    <div className={styles.analyticsGrid}><section><h3>HTTP Status Codes</h3>{analytics.statuses.map(x=><div className={styles.auditRow} key={x.statusCode}><b>{x.statusCode===0?"غير مكتمل":x.statusCode}</b><span>{x.requests} طلب</span></div>)}</section><section><h3>أوقات الذروة (ساعة)</h3>{analytics.peakHours.map(x=><div className={styles.auditRow} key={x.hour}><b>{String(x.hour).padStart(2,"0")}:00</b><span>{x.requests} طلب</span></div>)}</section></div>
    <div className={styles.tableWrap}><h3>أحدث الطلبات خلال 24 ساعة</h3><table><thead><tr><th>الخدمة</th><th>المستخدم</th><th>الحالة</th><th>الزمن</th><th>التاريخ</th></tr></thead><tbody>{analytics.recent.map(x=><tr key={x.id}><td>{x.service}</td><td>{profiles.find(p=>p.id===x.userId)?.display_name||profiles.find(p=>p.id===x.userId)?.email||"—"}</td><td>{x.status??"—"}</td><td>{x.latency===null?"—":x.latency+" ms"}</td><td>{date(x.createdAt)}</td></tr>)}</tbody></table></div></>}
    {!analytics&&<p className={styles.empty}>اختر الفترة والفلاتر ثم حمّل التحليلات.</p>}
   </section>}
   {tab==="users"&&<section className={styles.panel}><div className={styles.toolbar}><h2>إدارة الحسابات والمستويات</h2><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بالاسم أو البريد أو المعرف"/></div><div className={styles.tableWrap}><table><thead><tr><th>الحساب</th><th>الدور</th><th>المستوى</th><th>انتهاء المستوى</th><th>الحالة</th><th>تاريخ الانضمام</th></tr></thead><tbody>{filteredProfiles.map(p=><tr key={p.id}><td><b>{p.display_name||"بدون اسم"}</b><small>{p.email}</small></td><td><select value={p.role==="owner"?"owner":p.role} disabled={p.role==="owner"||busy||(role==="admin")} onChange={e=>void updateProfile(p,"role",e.target.value)}><option value="user">مستخدم</option><option value="admin">مشرف</option><option value="owner">مالك</option></select></td><td><select value={p.plan} disabled={busy||p.role==="owner"||(role==="admin"&&p.role==="admin")} onChange={e=>void updateProfile(p,"plan",e.target.value)}><option value="basic">Basic</option><option value="pro">Pro</option><option value="premium">Premium</option></select><small>{p.plan_source==="manual"?"تعيين يدوي":p.plan_source}</small></td><td><input type="date" value={p.plan_expires_at?.slice(0,10)||""} disabled={busy||p.role==="owner"||(role==="admin"&&p.role==="admin")} onChange={e=>void updateProfileExpiry(p,e.target.value)} aria-label="تاريخ انتهاء المستوى"/></td><td><select value={p.account_status} disabled={busy||p.role==="owner"||p.id===user.id||(role==="admin"&&p.role==="admin")} onChange={e=>void updateProfile(p,"account_status",e.target.value)}><option value="active">نشط</option><option value="suspended">موقوف</option></select></td><td>{date(p.created_at)}</td></tr>)}</tbody></table></div><p className={styles.hint}>تعيين المستوى يدوي ولا يتأثر باشتراك مستقبلي. عند تحديد انتهاء للمستوى، تُطبق مهلة سماح 7 أيام تلقائياً من الخادم.</p></section>}
   {tab==="services"&&<section className={styles.panel}><div className={styles.toolbar}><h2>كتالوج الخدمات وإصداراتها</h2><div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث عن خدمة"/><button className={styles.primary} onClick={()=>{setServiceForm(blankService);setShowServiceForm(true)}}>إضافة خدمة</button></div></div>{showServiceForm&&<div className={styles.form}><div className={styles.formGrid}><label>الاسم<input value={serviceForm.name} onChange={e=>setServiceForm({...serviceForm,name:e.target.value})}/></label><label>المعرّف (slug)<input value={serviceForm.slug} onChange={e=>setServiceForm({...serviceForm,slug:e.target.value})}/></label><label>المجال<input value={serviceForm.category} onChange={e=>setServiceForm({...serviceForm,category:e.target.value})}/></label><label>المسار الداخلي<input value={serviceForm.endpoint_path} onChange={e=>setServiceForm({...serviceForm,endpoint_path:e.target.value})} placeholder="/api/v1/..."/></label><label>HTTP Method<select value={serviceForm.http_method} onChange={e=>setServiceForm({...serviceForm,http_method:e.target.value})}>{["GET","POST","PUT","PATCH","DELETE"].map(x=><option key={x}>{x}</option>)}</select></label><label>وزن الخدمة (1–100)<input type="number" min="1" max="100" value={serviceForm.weight} onChange={e=>setServiceForm({...serviceForm,weight:Number(e.target.value)})}/></label><label>الحالة<select value={serviceForm.status} onChange={e=>setServiceForm({...serviceForm,status:e.target.value})}><option value="active">نشطة</option><option value="maintenance">صيانة</option><option value="disabled">معطلة</option></select></label></div><label>الوصف<textarea value={serviceForm.description} onChange={e=>setServiceForm({...serviceForm,description:e.target.value})}/></label><label>التوثيق Markdown<textarea value={serviceForm.docs_markdown} onChange={e=>setServiceForm({...serviceForm,docs_markdown:e.target.value})}/></label><div className={styles.actions}><button onClick={()=>setShowServiceForm(false)}>إلغاء</button><button className={styles.primary} disabled={busy} onClick={()=>void saveService()}>حفظ ونشر</button></div></div>}<div className={styles.tableWrap}><table><thead><tr><th>الخدمة</th><th>المسار</th><th>الحالة</th><th>الإصدار</th><th>إجراء</th></tr></thead><tbody>{filteredServices.map(s=><tr key={s.id}><td><b>{s.name}</b><small>{s.slug}</small></td><td dir="ltr">{s.http_method} {s.endpoint_path}</td><td>{s.archived_at?"مؤرشفة":label(s.status)}</td><td>v{s.current_version||1}</td><td><div className={styles.actions}><button onClick={()=>{setServiceForm({...s});setShowServiceForm(true)}}>تعديل</button><button onClick={()=>void archiveService(s)}>{s.archived_at?"استعادة":"أرشفة"}</button></div></td></tr>)}</tbody></table></div></section>}
   {tab==="submissions"&&<section className={styles.panel}><h2>مراجعة طلبات إضافة API</h2>{submissions.map(s=><article className={styles.submission} key={s.id}><div><b>{s.name}</b><small>{s.slug} · {label(s.review_status)} · {date(s.created_at)}</small><p>{s.description}</p><a href={s.endpoint_url} target="_blank" rel="noreferrer">{s.endpoint_url}</a></div><textarea value={reviewNotes[s.id]??s.review_note??""} onChange={e=>setReviewNotes(v=>({...v,[s.id]:e.target.value}))} placeholder="ملاحظة المراجعة"/><div className={styles.actions}><button onClick={()=>void reviewSubmission(s,"changes_requested")}>طلب تعديل</button><button onClick={()=>void reviewSubmission(s,"rejected")}>رفض</button><button className={styles.primary} onClick={()=>void reviewSubmission(s,"approved")}>قبول</button></div></article>)}{!submissions.length&&<p className={styles.empty}>لا توجد طلبات إضافة حتى الآن.</p>}</section>}
   {tab==="plans"&&<section className={styles.panel}><h2>حدود مستويات المستخدمين</h2><p className={styles.hint}>هذه القيم هي الإعدادات الأساسية لكل مستوى، ويُحتسب الحد على Weighted Usage وليس عدد الطلبات الخام فقط. تجاوز الحدود يرسل تحذيرات ولا يوقف الطلبات.</p>{plans.map(p=><PlanEditor key={p.plan} plan={p} busy={busy} onSave={savePlan}/>)}{adminLimit&&<AdminLimitEditor value={adminLimit} busy={busy} onSave={saveAdminLimit}/>}</section>}
   {tab==="keys"&&<section className={styles.panel}><div className={styles.toolbar}><h2>إدارة مفاتيح المستخدمين</h2><div><input value={keyQuery} onChange={e=>setKeyQuery(e.target.value)} placeholder="بحث بالمستخدم أو المفتاح"/><select value={keyStatus} onChange={e=>setKeyStatus(e.target.value)}><option value="all">كل المفاتيح</option><option value="active">نشطة</option><option value="revoked">ملغاة</option><option value="expired">منتهية</option></select></div></div>
    {keyForm.id&&<div className={styles.form}><h3>تعديل المفتاح</h3><div className={styles.formGrid}><label>اسم المفتاح<input value={keyForm.label} onChange={e=>setKeyForm({...keyForm,label:e.target.value})}/></label><label>تاريخ الانتهاء<input type="date" value={keyForm.expiresAt} onChange={e=>setKeyForm({...keyForm,expiresAt:e.target.value})}/></label></div><label>Scopes مفصولة بفواصل<input value={keyForm.scopes} onChange={e=>setKeyForm({...keyForm,scopes:e.target.value})} placeholder="api:use, service:aql-gemini"/></label><p className={styles.hint}>استخدم api:use دائمًا، ويمكن تقييد المفتاح بخدمة مثل service:aql-gemini أو مجال مثل category:ai.</p><div className={styles.actions}><button onClick={()=>setKeyForm({id:"",label:"",expiresAt:"",scopes:"api:use"})}>إلغاء</button><button className={styles.primary} disabled={busy} onClick={()=>void saveAdminKey()}>حفظ التعديلات</button></div></div>}
    <div className={styles.tableWrap}><table><thead><tr><th>صاحب المفتاح</th><th>المفتاح</th><th>الصلاحيات</th><th>آخر استخدام</th><th>الانتهاء</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{filteredKeys.map(k=><tr key={k.id}><td><b>{k.displayName||"بدون اسم"}</b><small>{k.email}</small></td><td><b>{k.label}</b><small dir="ltr">{k.keyPrefix}••••</small></td><td><small>{k.scopes.join(" · ")}</small></td><td>{date(k.lastUsedAt)}</td><td>{date(k.expiresAt)}</td><td>{k.revokedAt?"ملغى":k.expiresAt&&new Date(k.expiresAt)<=new Date()?"منتهي":"نشط"}</td><td><div className={styles.actions}><button disabled={!!k.revokedAt||busy} onClick={()=>setKeyForm({id:k.id,label:k.label,expiresAt:k.expiresAt?.slice(0,10)||"",scopes:k.scopes.join(", ")})}>تعديل</button><button disabled={!!k.revokedAt||busy} onClick={()=>void revokeAdminKey(k)}>إلغاء</button></div></td></tr>)}</tbody></table></div>{!filteredKeys.length&&<p className={styles.empty}>لا توجد مفاتيح مطابقة.</p>}</section>}
   {tab==="audit"&&<section className={styles.panel}><h2>سجل التدقيق الإداري</h2>{audit.map(a=><div className={styles.auditRow} key={a.id}><b>{a.action}</b><span>{a.entity_type} · {a.entity_id||"—"}</span><small>{JSON.stringify(a.details||{})}</small><time>{date(a.created_at)}</time></div>)}{!audit.length&&<p className={styles.empty}>لا توجد عمليات مسجلة.</p>}</section>}
   {tab==="notifications"&&<section className={styles.panel}><h2>إرسال إشعار داخل المنصة</h2><div className={styles.form}><label>المستلم<select value={notification.user_id} onChange={e=>setNotification({...notification,user_id:e.target.value})}><option value="all">كل المستخدمين</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name||p.email||p.id}</option>)}</select></label><label>الأهمية<select value={notification.type} onChange={e=>setNotification({...notification,type:e.target.value})}><option value="info">معلوماتي</option><option value="warning">تحذيري</option><option value="critical">حرج</option></select></label><label>العنوان<input value={notification.title} onChange={e=>setNotification({...notification,title:e.target.value})}/></label><label>المحتوى<textarea value={notification.body} onChange={e=>setNotification({...notification,body:e.target.value})}/></label><button className={styles.primary} disabled={busy} onClick={()=>void sendNotification()}>إرسال الإشعار</button></div></section>}
   {tab==="incidents"&&<section className={styles.panel}><h2>إدارة الحوادث</h2><div className={styles.form}><label>عنوان الحادث<input value={incidentForm.title} onChange={e=>setIncidentForm({...incidentForm,title:e.target.value})}/></label><label>الوصف<textarea value={incidentForm.description} onChange={e=>setIncidentForm({...incidentForm,description:e.target.value})}/></label><div className={styles.formGrid}><label>الخطورة<select value={incidentForm.severity} onChange={e=>setIncidentForm({...incidentForm,severity:e.target.value})}><option value="minor">منخفض</option><option value="major">مرتفع</option><option value="critical">حرج</option></select></label><label>الحالة<select value={incidentForm.status} onChange={e=>setIncidentForm({...incidentForm,status:e.target.value})}><option value="investigating">قيد التحقيق</option><option value="identified">تم تحديد السبب</option><option value="monitoring">تحت المراقبة</option></select></label></div><button className={styles.primary} onClick={()=>void createIncident()}>تسجيل حادث</button></div>{incidents.map(i=><div className={styles.auditRow} key={i.id}><b>{i.title}</b><span>{label(i.severity)} · {label(i.status)}</span><time>{date(i.started_at)}</time><select value={i.status} onChange={e=>void changeIncident(i,e.target.value)}><option value="investigating">قيد التحقيق</option><option value="identified">تم تحديد السبب</option><option value="monitoring">تحت المراقبة</option><option value="resolved">تم الحل</option></select></div>)}</section>}
   {tab==="maintenance"&&<section className={styles.panel}><h2>وضع الصيانة</h2><div className={styles.form}><label>النطاق<select value={maintenanceForm.service_id} onChange={e=>setMaintenanceForm({...maintenanceForm,service_id:e.target.value})}><option value="">كل الخدمات (عام)</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>رسالة الصيانة<textarea value={maintenanceForm.message} onChange={e=>setMaintenanceForm({...maintenanceForm,message:e.target.value})}/></label><div className={styles.formGrid}><label>البداية<input type="datetime-local" value={maintenanceForm.starts_at} onChange={e=>setMaintenanceForm({...maintenanceForm,starts_at:e.target.value})}/></label><label>النهاية<input type="datetime-local" value={maintenanceForm.ends_at} onChange={e=>setMaintenanceForm({...maintenanceForm,ends_at:e.target.value})}/></label></div><label className={styles.check}><input type="checkbox" checked={maintenanceForm.enabled} onChange={e=>setMaintenanceForm({...maintenanceForm,enabled:e.target.checked})}/> تفعيل الصيانة عند الحفظ</label><button className={styles.primary} onClick={()=>void saveMaintenance()}>حفظ إعداد الصيانة</button></div>{maintenance.map(m=><div className={styles.auditRow} key={m.id}><b>{m.service_id?services.find(s=>s.id===m.service_id)?.name||"خدمة":"كل الخدمات"}</b><span>{m.message}</span><time>{m.enabled?"مفعلة":"متوقفة"}</time><button onClick={()=>void markMaintenance(m)}>{m.enabled?"إيقاف":"تفعيل"}</button></div>)}</section>}
  </section>
 </main>;
}

function PlanEditor({plan,busy,onSave}:{plan:Plan;busy:boolean;onSave:(p:Plan)=>Promise<void>}){
 const [value,setValue]=useState(plan);
 useEffect(()=>setValue(plan),[plan]);
 return <div className={styles.planEditor}><h3>{label(plan.plan)}</h3><div className={styles.formGrid}>
  <label>Requests / minute<input type="number" min="1" value={value.requests_per_minute} onChange={e=>setValue({...value,requests_per_minute:Number(e.target.value)})}/></label>
  <label>Maximum API keys<input type="number" min="1" value={value.max_api_keys} onChange={e=>setValue({...value,max_api_keys:Number(e.target.value)})}/></label>
  <label>Daily weighted limit<input type="number" min="1" value={value.daily_weighted_limit} onChange={e=>setValue({...value,daily_weighted_limit:Number(e.target.value)})}/></label>
  <label>Monthly weighted limit<input type="number" min="1" value={value.monthly_weighted_limit} onChange={e=>setValue({...value,monthly_weighted_limit:Number(e.target.value)})}/></label>
 </div><button className={styles.primary} disabled={busy} onClick={()=>void onSave(value)}>حفظ حدود {label(plan.plan)}</button></div>;
}

function AdminLimitEditor({value,busy,onSave}:{value:AdminLimit;busy:boolean;onSave:(v:AdminLimit)=>Promise<void>}){
 const [form,setForm]=useState(value);
 useEffect(()=>setForm(value),[value]);
 return <div className={styles.planEditor}><h3>حدود الإدارة المستقلة</h3><div className={styles.formGrid}>
  <label>Requests / minute<input type="number" min="1" value={form.requests_per_minute} onChange={e=>setForm({...form,requests_per_minute:Number(e.target.value)})}/></label>
  <label>Maximum API keys<input type="number" min="1" value={form.max_api_keys} onChange={e=>setForm({...form,max_api_keys:Number(e.target.value)})}/></label>
  <label>Daily weighted limit<input type="number" min="1" value={form.daily_weighted_limit} onChange={e=>setForm({...form,daily_weighted_limit:Number(e.target.value)})}/></label>
  <label>Monthly weighted limit<input type="number" min="1" value={form.monthly_weighted_limit} onChange={e=>setForm({...form,monthly_weighted_limit:Number(e.target.value)})}/></label>
 </div><button className={styles.primary} disabled={busy} onClick={()=>void onSave(form)}>حفظ حدود الإدارة</button></div>;
}
