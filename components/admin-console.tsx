"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./admin-console.module.css";

type Tab = "overview" | "analytics" | "users" | "keys" | "services" | "plans" | "audit" | "monitor";
type Profile = { id:string; email:string|null; display_name:string|null; role:string; plan:string; plan_source:string; plan_expires_at:string|null; account_status:string; created_at:string };
type Service = { id:string; slug:string; name:string; description:string; category:string; endpoint_path:string; http_method:string; docs_markdown:string; status:string; source_type:string; weight:number; archived_at:string|null; current_version:number; created_at:string };
type Plan = { plan:string; requests_per_minute:number; max_api_keys:number; daily_weighted_limit:number; monthly_weighted_limit:number };
type Audit = { id:number; actor_id:string|null; action:string; entity_type:string; entity_id:string|null; details:Record<string,unknown>; created_at:string };
type AdminAuditEntry = {id:number;actorId:string|null;actorName:string|null;actorEmail:string|null;action:string;entityType:string;entityId:string|null;details:Record<string,unknown>;createdAt:string};
type AdminAuditResponse = {items:AdminAuditEntry[];total:number;page:number;pageSize:number;totalPages:number;hours:number};
type Incident = { id:string; title:string; description:string; severity:string; status:string; affected_services:string[]; started_at:string; resolved_at:string|null };
type IncidentUpdate = {id:string;incident_id:string;status:string|null;message:string;created_by:string|null;created_at:string};
type Maintenance = { id:string; service_id:string|null; enabled:boolean; message:string; starts_at:string|null; ends_at:string|null };
type ServiceDependency = {id:string;service_id:string;depends_on_service_id:string;dependency_type:"required"|"optional";description:string;created_by:string|null;created_at:string};
type AdminKey = {id:string;userId:string;displayName:string|null;email:string|null;label:string;keyPrefix:string;scopes:string[];createdAt:string;lastUsedAt:string|null;expiresAt:string|null;revokedAt:string|null};
type ServiceVersion = {id:string;version:number;snapshot:Record<string,unknown>;changeNote:string;createdBy:string|null;createdAt:string};
type AdminLimit = {id:boolean;requests_per_minute:number;max_api_keys:number;daily_weighted_limit:number;monthly_weighted_limit:number};
type AdminRequestLog = {id:number;userId:string|null;displayName:string|null;email:string|null;keyLabel:string|null;service:string;method:string;status:number|null;latency:number|null;weight:number;createdAt:string};
type AdminRequestLogsResponse = {items:AdminRequestLog[];total:number;page:number;pageSize:number;totalPages:number;hours:number};
type AdminAnalytics = {periodDays:number;hourly:{hour:string;requests:number;weightedUsage:number}[];totals:{requests:number;weightedUsage:number;errors:number;successRate:number|null;avgLatency:number|null;measuredRequests:number};daily:{date:string;requests:number;weightedUsage:number;errors:number;avgLatency:number|null}[];services:{slug:string;name:string;requests:number;weightedUsage:number;errors:number}[];users:{userId:string;name:string;email:string|null;requests:number;weightedUsage:number;errors:number}[];statuses:{statusCode:number;requests:number}[];peakHours:{hour:number;requests:number}[];recent:{id:number;userId:string;service:string;method:string;status:number|null;latency:number|null;createdAt:string}[]};
const TABS: {id:Tab;label:string}[] = [
 {id:"overview",label:"نظرة عامة"},
 {id:"analytics",label:"التحليلات"},
 {id:"users",label:"المستخدمون"},
 {id:"keys",label:"مفاتيح API"},
 {id:"services",label:"الخدمات"},
 {id:"plans",label:"الخطط والحدود"},
 {id:"audit",label:"سجل التدقيق"},
 {id:"monitor",label:"مراقبة المنصة"}
];
const blankService = {id:"",slug:"",name:"",description:"",category:"AI",endpoint_path:"",http_method:"POST",docs_markdown:"",status:"active",source_type:"official",weight:1};
const label = (value:string) => ({basic:"Basic",pro:"Pro",premium:"Premium",user:"مستخدم",admin:"مشرف",owner:"مالك",active:"نشط",suspended:"موقوف",pending:"قيد المراجعة",approved:"مقبول",rejected:"مرفوض",changes_requested:"مطلوب تعديل",investigating:"قيد التحقيق",identified:"تم تحديد السبب",monitoring:"تحت المراقبة",resolved:"تم الحل",received:"تم الاستلام",reviewing:"قيد المراجعة",in_progress:"جارٍ العمل",closed:"مغلقة",minor:"منخفض",major:"مرتفع",critical:"حرج"} as Record<string,string>)[value] || value;
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
 const [plans,setPlans]=useState<Plan[]>([]);
 const [audit,setAudit]=useState<Audit[]>([]);
 const [incidents,setIncidents]=useState<Incident[]>([]);
 const [incidentUpdates,setIncidentUpdates]=useState<IncidentUpdate[]>([]);
 const [incidentUpdateNotes,setIncidentUpdateNotes]=useState<Record<string,string>>({});
 const [maintenance,setMaintenance]=useState<Maintenance[]>([]);
 const [dependencies,setDependencies]=useState<ServiceDependency[]>([]);
 const [dependencyForm,setDependencyForm]=useState({service_id:"",depends_on_service_id:"",dependency_type:"required" as "required"|"optional",description:""});
 const [exportDataset,setExportDataset]=useState("audit");
 const [query,setQuery]=useState("");
 const [moderatorCandidate,setModeratorCandidate]=useState("");
 const [serviceForm,setServiceForm]=useState(blankService);
 const [showServiceForm,setShowServiceForm]=useState(false);
 const [notification,setNotification]=useState({user_id:"all",title:"",body:"",type:"info"});
 const [incidentForm,setIncidentForm]=useState({title:"",description:"",severity:"minor",status:"investigating",affected_services:[] as string[]});
 const [maintenanceForm,setMaintenanceForm]=useState({service_id:"",message:"الخدمة تحت الصيانة مؤقتاً.",enabled:true,starts_at:"",ends_at:""});
 const [analytics,setAnalytics]=useState<AdminAnalytics|null>(null);
 const [requestLogs,setRequestLogs]=useState<AdminRequestLog[]>([]);
 const [requestLogsTotal,setRequestLogsTotal]=useState(0);
 const [requestLogsPage,setRequestLogsPage]=useState(1);
 const [requestLogsTotalPages,setRequestLogsTotalPages]=useState(1);
 const [requestLogsHours,setRequestLogsHours]=useState(24);
 const [requestLogsService,setRequestLogsService]=useState("");
 const [requestLogsUser,setRequestLogsUser]=useState("");
 const [requestLogsResult,setRequestLogsResult]=useState("all");
 const [requestLogsStatus,setRequestLogsStatus]=useState("");
 const [auditRows,setAuditRows]=useState<AdminAuditEntry[]>([]);
 const [auditRowsTotal,setAuditRowsTotal]=useState(0);
 const [auditRowsPage,setAuditRowsPage]=useState(1);
 const [auditRowsTotalPages,setAuditRowsTotalPages]=useState(1);
 const [auditHours,setAuditHours]=useState(0);
 const [auditActor,setAuditActor]=useState("");
 const [auditAction,setAuditAction]=useState("");
 const [auditEntityType,setAuditEntityType]=useState("");
 const [auditQuery,setAuditQuery]=useState("");
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
 const [versionService,setVersionService]=useState<Service|null>(null);
 const [serviceVersions,setServiceVersions]=useState<ServiceVersion[]>([]);

 const load=useCallback(async()=>{
  if(!supabase||!user)return;
  setBusy(true);setError("");
  try{
   const [p,s,pl,au,inc,iu,mw,k,al,dep]=await Promise.all([
    supabase.from("profiles").select("id,email,display_name,role,plan,plan_source,plan_expires_at,account_status,created_at").order("created_at",{ascending:false}),
    supabase.from("api_services").select("id,slug,name,description,category,endpoint_path,http_method,docs_markdown,status,source_type,weight,archived_at,current_version,created_at").order("created_at",{ascending:false}),
    supabase.from("api_plan_limits").select("plan,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit").order("plan"),
    supabase.from("audit_logs").select("id,actor_id,action,entity_type,entity_id,details,created_at").order("created_at",{ascending:false}).limit(100),
    supabase.from("incidents").select("id,title,description,severity,status,affected_services,started_at,resolved_at").order("started_at",{ascending:false}),
    supabase.from("incident_updates").select("id,incident_id,status,message,created_by,created_at").order("created_at",{ascending:false}),
    supabase.from("maintenance_windows").select("id,service_id,enabled,message,starts_at,ends_at").order("updated_at",{ascending:false}),
    supabase.rpc("bmg_admin_list_api_keys",{p_user_id:undefined,p_status:"all"}),
    supabase.from("api_admin_limits").select("id,requests_per_minute,max_api_keys,daily_weighted_limit,monthly_weighted_limit").eq("id",true).maybeSingle(),
    supabase.from("api_service_dependencies").select("id,service_id,depends_on_service_id,dependency_type,description,created_by,created_at").order("created_at",{ascending:false})
   ]);
   for(const x of [p,s,pl,au,inc,iu,mw,k,al,dep])if(x.error)throw x.error;
   setProfiles((p.data||[]) as Profile[]);setServices((s.data||[]) as Service[]);
   setPlans((pl.data||[]) as Plan[]);setAudit((au.data||[]) as Audit[]);setIncidents((inc.data||[]) as Incident[]);setIncidentUpdates((iu.data||[]) as IncidentUpdate[]);setMaintenance((mw.data||[]) as Maintenance[]);setApiKeys((k.data||[]) as unknown as AdminKey[]);setAdminLimit((al.data||null) as AdminLimit|null);setDependencies((dep.data||[]) as ServiceDependency[]);
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
 const filteredKeys=useMemo(()=>apiKeys.filter(k=>(keyStatus==="all"||(keyStatus==="active"&&(!k.expiresAt||new Date(k.expiresAt)>new Date()))||(keyStatus==="expired"&&!!k.expiresAt&&new Date(k.expiresAt)<=new Date()))&&[k.label,k.keyPrefix,k.email,k.displayName,k.userId,k.scopes.join(" ")].some(v=>String(v||"").toLowerCase().includes(keyQuery.toLowerCase()))),[apiKeys,keyStatus,keyQuery]);
 const loadAnalytics=useCallback(async()=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.rpc("bmg_get_admin_analytics",{p_days:analyticsDays,p_service:analyticsService||undefined,p_user_id:analyticsUser||undefined,p_category:analyticsCategory||undefined,p_status_code:analyticsStatus?Number(analyticsStatus):undefined});
   if(error)throw error;
   setAnalytics(data as unknown as AdminAnalytics);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل التحليلات.");}
  finally{setBusy(false);}
 },[supabase,analyticsDays,analyticsService,analyticsUser,analyticsCategory,analyticsStatus]);
 useEffect(()=>{if(tab==="analytics"&&ready&&user&&["admin","owner"].includes(role))void loadAnalytics()},[tab,ready,user,role,loadAnalytics]);
 const loadRequestLogs=useCallback(async(page:number=1)=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.rpc("bmg_admin_get_request_logs",{
    p_page:page,p_page_size:25,p_service:requestLogsService||undefined,
    p_user_id:requestLogsUser||undefined,p_result:requestLogsResult,
    p_status_code:requestLogsStatus?Number(requestLogsStatus):undefined,p_hours:requestLogsHours
   });
   if(error)throw error;
   const result=data as unknown as AdminRequestLogsResponse;
   setRequestLogs(result.items||[]);setRequestLogsTotal(result.total||0);
   setRequestLogsPage(result.page||page);setRequestLogsTotalPages(result.totalPages||1);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل سجلات الطلبات.");}
  finally{setBusy(false);}
 },[supabase,requestLogsService,requestLogsUser,requestLogsResult,requestLogsStatus,requestLogsHours]);
 useEffect(()=>{if(tab==="analytics"&&ready&&user&&["admin","owner"].includes(role))void loadRequestLogs(1)},[tab,ready,user,role,loadRequestLogs]);
 const loadAuditLogs=useCallback(async(page:number=1)=>{
  if(!supabase)return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.rpc("bmg_admin_get_audit_logs",{
    p_page:page,p_page_size:25,p_actor_id:auditActor||undefined,
    p_action:auditAction.trim()||undefined,p_entity_type:auditEntityType.trim()||undefined,
    p_query:auditQuery.trim()||undefined,p_hours:auditHours
   });
   if(error)throw error;
   const result=data as unknown as AdminAuditResponse;
   setAuditRows(result.items||[]);setAuditRowsTotal(result.total||0);
   setAuditRowsPage(result.page||page);setAuditRowsTotalPages(result.totalPages||1);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل سجل التدقيق.");}
  finally{setBusy(false);}
 },[supabase,auditActor,auditAction,auditEntityType,auditQuery,auditHours]);
 useEffect(()=>{if(tab==="audit"&&ready&&user&&["admin","owner"].includes(role))void loadAuditLogs(1)},[tab,ready,user,role,loadAuditLogs]);
 const exportCenterFile=(format:"json"|"csv")=>{
  const datasets:Record<string,{name:string;rows:Record<string,unknown>[]}> = {
   audit:{name:"audit-logs",rows:auditRows.map(x=>({id:x.id,createdAt:x.createdAt,actorName:x.actorName,actorEmail:x.actorEmail,action:x.action,entityType:x.entityType,entityId:x.entityId,details:x.details}))},
   requests:{name:"request-logs",rows:requestLogs.map(x=>({id:x.id,createdAt:x.createdAt,userId:x.userId,displayName:x.displayName,email:x.email,keyLabel:x.keyLabel,service:x.service,method:x.method,status:x.status,latency:x.latency,weight:x.weight}))},
   users:{name:"users",rows:profiles.map(x=>({id:x.id,email:x.email,displayName:x.display_name,role:x.role,plan:x.plan,planSource:x.plan_source,planExpiresAt:x.plan_expires_at,accountStatus:x.account_status,createdAt:x.created_at}))},
   services:{name:"services",rows:services.map(x=>({id:x.id,slug:x.slug,name:x.name,category:x.category,status:x.status,method:x.http_method,path:x.endpoint_path,weight:x.weight,version:x.current_version,archivedAt:x.archived_at}))},
   keys:{name:"api-keys",rows:apiKeys.map(x=>({id:x.id,userId:x.userId,displayName:x.displayName,email:x.email,label:x.label,keyPrefix:x.keyPrefix,scopes:x.scopes.join(" "),createdAt:x.createdAt,lastUsedAt:x.lastUsedAt,expiresAt:x.expiresAt}))},
   incidents:{name:"incidents",rows:incidents.map(x=>({id:x.id,title:x.title,severity:x.severity,status:x.status,affectedServices:x.affected_services.join(" "),startedAt:x.started_at,resolvedAt:x.resolved_at}))},
   maintenance:{name:"maintenance",rows:maintenance.map(x=>({id:x.id,serviceId:x.service_id,enabled:x.enabled,message:x.message,startsAt:x.starts_at,endsAt:x.ends_at}))}
  };
  const selected=datasets[exportDataset];
  if(!selected||!selected.rows.length){setError("لا توجد بيانات محملة للتصدير في هذا القسم.");return;}
  const rows=selected.rows;
  const csvCell=(v:unknown)=>'"'+String(v===null||v===undefined?"":typeof v==="object"?JSON.stringify(v):v).replace(/"/g,'""')+'"';
  const content=format==="json"?JSON.stringify({platform:"NOX APIS",exportedAt:new Date().toISOString(),dataset:exportDataset,total:rows.length,items:rows},null,2):[
   Object.keys(rows[0]).map(csvCell).join(","),
   ...rows.map(row=>Object.keys(rows[0]).map(key=>csvCell(row[key])).join(","))
  ].join("\n");
  const blob=new Blob([content],{type:format==="json"?"application/json;charset=utf-8":"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="nox-apis-"+selected.name+"-"+new Date().toISOString().slice(0,10)+"."+format;link.click();URL.revokeObjectURL(url);
  void writeAudit("export.create","export",exportDataset,{format,rows:rows.length});
 };
 const exportAuditLogs=(format:"json"|"csv")=>{
  const content=format==="json"?JSON.stringify(auditRows,null,2):[
   "createdAt,actorName,actorEmail,action,entityType,entityId,details",
   ...auditRows.map(x=>[x.createdAt,x.actorName||"",x.actorEmail||"",x.action,x.entityType,x.entityId||"",JSON.stringify(x.details||{})].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","))
  ].join("\n");
  const blob=new Blob([content],{type:format==="json"?"application/json;charset=utf-8":"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="nox-api-audit-page-"+auditRowsPage+"."+format;link.click();URL.revokeObjectURL(url);
 };
 const exportRequestLogs=(format:"json"|"csv")=>{
  const content=format==="json"?JSON.stringify({total:requestLogsTotal,hours:requestLogsHours,items:requestLogs},null,2):[
   "createdAt,user,email,keyLabel,service,method,status,latencyMs,weight",
   ...requestLogs.map(x=>[x.createdAt,x.displayName||"",x.email||"",x.keyLabel||"",x.service,x.method,x.status??"",x.latency??"",x.weight].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","))
  ].join("\n");
  const blob=new Blob([content],{type:format==="json"?"application/json;charset=utf-8":"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="nox-api-request-logs-"+requestLogsHours+"h."+format;link.click();URL.revokeObjectURL(url);
 };

 const exportAnalytics=(format:"json"|"csv")=>{
  if(!analytics)return;
  const content=format==="json"?JSON.stringify(analytics,null,2):[
   "date,requests,weightedUsage,errors,avgLatency",
   ...(analyticsDays===1?analytics.hourly.map(x=>[x.hour,x.requests,x.weightedUsage,"",""].join(",")):analytics.daily.map(x=>[x.date,x.requests,x.weightedUsage,x.errors,x.avgLatency??""].join(",")))
  ].join("\n");
  const blob=new Blob([content],{type:format==="json"?"application/json;charset=utf-8":"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="bmg-analytics-"+analyticsDays+"d."+format;link.click();URL.revokeObjectURL(url);
 };
 const writeAudit=async(action:string,entityType:string,entityId:string|null,details:Record<string,unknown>={})=>{
  if(!supabase||!user)return;
  const {error}=await supabase.from("audit_logs").insert({actor_id:user.id,action,entity_type:entityType,entity_id:entityId,details:details as Json});
  if(error)throw error;
 };
 const runAdminCommand=async<T=unknown>(command:string,input:Record<string,unknown>):Promise<T>=>{
  const response=await fetch("/api/admin/commands",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({command,input})});
  const payload=await response.json().catch(()=>null) as {success?:boolean;result?:T;error?:string}|null;
  if(!response.ok||!payload?.success)throw new Error(payload?.error||"تعذر تنفيذ الأمر الإداري.");
  return payload.result as T;
 };
 const updateProfile=async(p:Profile,field:"role"|"plan"|"account_status",value:string)=>{
  if(!supabase)return;
  const next={role:field==="role"?value:p.role,plan:field==="plan"?value:p.plan,account_status:field==="account_status"?value:p.account_status};
  setBusy(true);setError("");setNotice("");
  try{
   await runAdminCommand(next.role==="admin"?"profile.grant_admin":"profile.update",{userId:p.id,role:next.role,plan:next.plan,planExpiresAt:p.plan_expires_at??null,accountStatus:next.account_status});
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
   await runAdminCommand("profile.update",{userId:p.id,role:p.role,plan:p.plan,planExpiresAt:expiresAt,accountStatus:p.account_status});
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
 const loadServiceVersions=async(service:Service)=>{
  setVersionService(service);setBusy(true);setError("");
  try{
   const versions=await runAdminCommand<ServiceVersion[]>("service.versions.list",{serviceId:service.id});
   setServiceVersions(versions||[]);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل إصدارات الخدمة.");}
  finally{setBusy(false);}
 };
 const rollbackServiceVersion=async(version:ServiceVersion)=>{
  if(!versionService||!confirm("استرجاع محتوى الإصدار v"+version.version+"؟ سيتم إنشاء إصدار جديد ولن تُحذف الإصدارات السابقة."))return;
  setBusy(true);setError("");
  try{
   const result=await runAdminCommand<{version:number}>("service.rollback",{serviceId:versionService.id,version:version.version});
   setNotice("تم الاسترجاع وإنشاء الإصدار v"+result.version+".");
   await loadServiceVersions({...versionService,current_version:result.version});
   await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر استرجاع الإصدار.");}
  finally{setBusy(false);}
 };
 const archiveService=async(s:Service)=>{
  const archived=!s.archived_at;
  if(!confirm(archived?"أرشفة الخدمة وإيقاف ظهورها للمستخدمين؟":"استعادة الخدمة إلى الكتالوج النشط؟"))return;
  setBusy(true);setError("");setNotice("");
  try{
   await runAdminCommand(archived?"service.archive":"service.restore",{serviceId:s.id,archived});
   setNotice(archived?"تمت أرشفة الخدمة.":"تمت استعادة الخدمة.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تغيير حالة الأرشفة.");}
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
  try{await runAdminCommand("api_key.update",{id:keyForm.id,label:keyForm.label,expiresAt:keyForm.expiresAt?new Date(keyForm.expiresAt+"T23:59:59").toISOString():null,scopes});setNotice("تم تحديث المفتاح وتسجيل العملية.");setKeyForm({id:"",label:"",expiresAt:"",scopes:"api:use"});await load()}catch(e){setError(e instanceof Error?e.message:"تعذر تحديث المفتاح.")}finally{setBusy(false)}
 };
 const deleteAdminKey=async(key:AdminKey)=>{
  if(!supabase||!confirm("حذف مفتاح "+key.label+" نهائيًا؟ ستُحذف سجلات الطلبات المرتبطة به ولن يمكن استعادته."))return;
  setBusy(true);setError("");
  try{await runAdminCommand("api_key.delete",{id:key.id});setNotice("تم حذف المفتاح نهائيًا.");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر حذف المفتاح نهائيًا.")}finally{setBusy(false)}
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
   const {data,error}=await supabase.from("incidents").insert({...incidentForm,created_by:user.id}).select("id").single();
   if(error)throw error;
   const {error:updateError}=await supabase.from("incident_updates").insert({incident_id:data.id,status:incidentForm.status,message:incidentForm.description.trim()||"تم تسجيل الحادث.",created_by:user.id});
   if(updateError)throw updateError;
   await writeAudit("incident.create","incident",data.id,{severity:incidentForm.severity,affected_services:incidentForm.affected_services});
   setIncidentForm({title:"",description:"",severity:"minor",status:"investigating",affected_services:[]});setNotice("تم تسجيل الحادث.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تسجيل الحادث.");}
  finally{setBusy(false);}
 };
 const changeIncident=async(i:Incident,status:string)=>{
  if(!supabase)return;
  setBusy(true);
  try{
   const {error}=await supabase.from("incidents").update({status,resolved_at:status==="resolved"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",i.id);
   if(error)throw error;
   const message=incidentUpdateNotes[i.id]?.trim()||("تم تحديث حالة الحادث إلى: "+label(status));
   const {error:updateError}=await supabase.from("incident_updates").insert({incident_id:i.id,status,message,created_by:user?.id});
   if(updateError)throw updateError;
   setIncidentUpdateNotes(v=>({...v,[i.id]:""}));
   await writeAudit("incident.status_change","incident",i.id,{status});setNotice("تم تحديث حالة الحادث وإضافة تحديث للسجل.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الحادث.");}
  finally{setBusy(false);}
 };
 const addIncidentUpdate=async(i:Incident)=>{
  if(!supabase||!user)return;
  const message=incidentUpdateNotes[i.id]?.trim();
  if(!message){setError("اكتب التحديث أولاً.");return;}
  setBusy(true);setError("");
  try{
   const {error}=await supabase.from("incident_updates").insert({incident_id:i.id,message,created_by:user.id});
   if(error)throw error;
   await writeAudit("incident.update","incident",i.id,{message});
   setIncidentUpdateNotes(v=>({...v,[i.id]:""}));setNotice("تم إضافة تحديث الحادث.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر إضافة تحديث الحادث.");}
  finally{setBusy(false);}
 };
 const saveDependency=async()=>{
  if(!dependencyForm.service_id||!dependencyForm.depends_on_service_id){setError("اختر الخدمتين أولاً.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   await runAdminCommand("service_dependency.create",dependencyForm as unknown as Record<string,unknown>);
   setDependencyForm({service_id:"",depends_on_service_id:"",dependency_type:"required",description:""});
   setNotice("تمت إضافة الاعتمادية.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر إضافة الاعتمادية. تحقق من عدم وجود دورة اعتماد.");}
  finally{setBusy(false);}
 };
 const deleteDependency=async(d:ServiceDependency)=>{
  if(!confirm("حذف علاقة الاعتماد بين الخدمتين؟"))return;
  setBusy(true);setError("");
  try{
   await runAdminCommand("service_dependency.delete",{id:d.id});
   setNotice("تم حذف الاعتمادية.");await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر حذف الاعتمادية.");}
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

 return <div className={styles.shell} dir="rtl">
  <header className={styles.header}>
   <div><small>NOX APIS / NEXUS OF XPERIENCE</small><h1>{TABS.find(t=>t.id===tab)?.label}</h1><span className={styles.roleLabel}>{role==="owner"?"مالك المنصة":"مشرف المنصة"} · {user.email}</span></div>
   <div className={styles.headerActions}><button onClick={()=>void load()} disabled={busy}>تحديث البيانات</button><Link href="/dashboard">لوحة المطور</Link></div>
  </header>
  <nav className={styles.adminTabs} role="tablist" aria-label="أقسام إدارة المنصة" aria-orientation="horizontal">{TABS.map((t,index)=><button type="button" key={t.id} id={"admin-tab-"+t.id} role="tab" aria-selected={tab===t.id} aria-controls="admin-tab-panel" tabIndex={tab===t.id?0:-1} onClick={()=>setTab(t.id)} onKeyDown={event=>{let next=index;if(event.key==="ArrowLeft")next=(index+1)%TABS.length;else if(event.key==="ArrowRight")next=(index-1+TABS.length)%TABS.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=TABS.length-1;else return;event.preventDefault();setTab(TABS[next].id);document.getElementById("admin-tab-"+TABS[next].id)?.focus()}} className={tab===t.id?styles.active:""}>{t.label}</button>)}</nav>
  <section className={styles.main} id="admin-tab-panel" role="tabpanel" aria-labelledby={"admin-tab-"+tab} tabIndex={0}>
   {error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}{busy&&<div className={styles.busy}>جارٍ تنفيذ العملية…</div>}
   {tab==="overview"&&<><div className={styles.stats}><article><small>المستخدمون</small><strong>{profiles.length}</strong></article><article><small>المشرفون</small><strong>{profiles.filter(p=>p.role==="admin").length}</strong></article><article><small>الخدمات النشطة</small><strong>{services.filter(s=>s.status==="active"&&!s.archived_at).length}</strong></article><article><small>الحوادث المفتوحة</small><strong>{incidents.filter(i=>i.status!=="resolved").length}</strong></article><article><small>نوافذ الصيانة المفعلة</small><strong>{maintenance.filter(m=>m.enabled).length}</strong></article></div><section className={styles.panel}><h2>آخر عمليات الإدارة</h2>{audit.slice(0,8).map(a=><div className={styles.auditRow} key={a.id}><b>{a.action}</b><span>{a.entity_type} · {a.entity_id||"—"}</span><time>{date(a.created_at)}</time></div>)}{!audit.length&&<p className={styles.empty}>لا توجد عمليات مسجلة بعد.</p>}</section></>}
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
    <div className={styles.analyticsGrid}><section><h3>الاستخدام اليومي</h3>{(analyticsDays===1?analytics.hourly.map(x=>({date:x.hour,requests:x.requests})):analytics.daily.map(x=>({date:x.date,requests:x.requests}))).map((x,i,arr)=><div className={styles.barRow} key={x.date}><span>{analyticsDays===1?x.date.slice(11,16):x.date}</span><div><i style={{width:Math.max(2,x.requests/Math.max(1,...arr.map(v=>v.requests))*100)+"%"}}/></div><b>{x.requests}</b></div>)}</section>
    <section><h3>توزيع الخدمات</h3>{analytics.services.map(x=><div className={styles.barRow} key={x.slug}><span>{x.name}</span><div><i style={{width:Math.max(2,x.weightedUsage/Math.max(1,...analytics.services.map(v=>v.weightedUsage))*100)+"%"}}/></div><b>{x.weightedUsage}</b></div>)}</section></div>
    <div className={styles.tableWrap}><h3>استهلاك المستخدمين</h3><table><thead><tr><th>المستخدم</th><th>الطلبات</th><th>Weighted Usage</th><th>الأخطاء</th></tr></thead><tbody>{analytics.users.map(x=><tr key={x.userId}><td><b>{x.name}</b><small>{x.email}</small></td><td>{x.requests}</td><td>{x.weightedUsage}</td><td>{x.errors}</td></tr>)}</tbody></table></div>
    <div className={styles.analyticsGrid}><section><h3>HTTP Status Codes</h3>{analytics.statuses.map(x=><div className={styles.auditRow} key={x.statusCode}><b>{x.statusCode===0?"غير مكتمل":x.statusCode}</b><span>{x.requests} طلب</span></div>)}</section><section><h3>أوقات الذروة (ساعة)</h3>{analytics.peakHours.map(x=><div className={styles.auditRow} key={x.hour}><b>{String(x.hour).padStart(2,"0")}:00</b><span>{x.requests} طلب</span></div>)}</section></div>
    <div className={styles.tableWrap}><h3>أحدث الطلبات خلال 24 ساعة</h3><table><thead><tr><th>الخدمة</th><th>المستخدم</th><th>الحالة</th><th>الزمن</th><th>التاريخ</th></tr></thead><tbody>{analytics.recent.map(x=><tr key={x.id}><td>{x.service}</td><td>{profiles.find(p=>p.id===x.userId)?.display_name||profiles.find(p=>p.id===x.userId)?.email||"—"}</td><td>{x.status??"—"}</td><td>{x.latency===null?"—":x.latency+" ms"}</td><td>{date(x.createdAt)}</td></tr>)}</tbody></table></div></>}
    {!analytics&&<p className={styles.empty}>اختر الفترة والفلاتر ثم حمّل التحليلات.</p>}
   </section>}
   {tab==="users"&&<section className={styles.panel}><div className={styles.toolbar}><h2>إدارة الحسابات والمستويات</h2><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بالاسم أو البريد أو المعرف"/></div><div className={styles.tableWrap}><table><thead><tr><th>الحساب</th><th>الدور</th><th>المستوى</th><th>انتهاء المستوى</th><th>الحالة</th><th>تاريخ الانضمام</th></tr></thead><tbody>{filteredProfiles.map(p=><tr key={p.id}><td><b>{p.display_name||"بدون اسم"}</b><small>{p.email}</small></td><td><select value={p.role==="owner"?"owner":p.role} disabled={p.role==="owner"||busy||(role==="admin")} onChange={e=>void updateProfile(p,"role",e.target.value)}><option value="user">مستخدم</option><option value="admin">مشرف</option><option value="owner" disabled>مالك</option></select></td><td><select value={p.plan} disabled={busy||p.role==="owner"||(role==="admin"&&p.role==="admin")} onChange={e=>void updateProfile(p,"plan",e.target.value)}><option value="basic">Basic</option><option value="pro">Pro</option><option value="premium">Premium</option></select><small>{p.plan_source==="manual"?"تعيين يدوي":p.plan_source}</small></td><td><input type="date" value={p.plan_expires_at?.slice(0,10)||""} disabled={busy||p.role==="owner"||(role==="admin"&&p.role==="admin")} onChange={e=>void updateProfileExpiry(p,e.target.value)} aria-label="تاريخ انتهاء المستوى"/></td><td><select value={p.account_status} disabled={busy||p.role==="owner"||p.id===user.id||(role==="admin"&&p.role==="admin")} onChange={e=>void updateProfile(p,"account_status",e.target.value)}><option value="active">نشط</option><option value="suspended">موقوف</option></select></td><td>{date(p.created_at)}</td></tr>)}</tbody></table></div><p className={styles.hint}>تعيين المستوى يدوي ولا يتأثر باشتراك مستقبلي. عند تحديد انتهاء للمستوى، تُطبق مهلة سماح 7 أيام تلقائياً من الخادم.</p></section>}
   {tab==="users"&&role==="owner"&&<section className={styles.panel}>
    <div className={styles.toolbar}><h2>إدارة المشرفين</h2><span className={styles.hint}>هذه الصلاحية متاحة لمالك المنصة فقط.</span></div>
    <div className={styles.form}>
     <h3>منح صلاحية مشرف</h3>
     <div className={styles.formGrid}>
      <label>اختر حساباً مسجلاً
       <select value={moderatorCandidate} onChange={e=>setModeratorCandidate(e.target.value)}>
        <option value="">اختر مستخدماً</option>
        {profiles.filter(p=>p.role==="user"&&p.account_status==="active").map(p=><option key={p.id} value={p.id}>{p.display_name||p.email||p.id} · {p.email||p.id}</option>)}
       </select>
      </label>
      <div className={styles.actions}><button className={styles.primary} disabled={busy||!moderatorCandidate} onClick={()=>{const candidate=profiles.find(p=>p.id===moderatorCandidate);if(candidate&&confirm("منح هذا الحساب صلاحية مشرف؟")){void updateProfile(candidate,"role","admin");setModeratorCandidate("");}}}>ترقية إلى مشرف</button></div>
     </div>
     <p className={styles.hint}>الحساب يجب أن يكون قد سجّل الدخول مرة واحدة على الأقل حتى يظهر هنا. لا يتم إنشاء حساب Google من لوحة المنصة.</p>
    </div>
    <h3>المشرفون الحاليون ({profiles.filter(p=>p.role==="admin").length})</h3>
    <div className={styles.tableWrap}><table><thead><tr><th>المشرف</th><th>الحالة</th><th>تاريخ الانضمام</th><th>الإجراء</th></tr></thead><tbody>
     {profiles.filter(p=>p.role==="admin").map(p=><tr key={p.id}><td><b>{p.display_name||"بدون اسم"}</b><small>{p.email}</small></td><td>{label(p.account_status)}</td><td>{date(p.created_at)}</td><td><button disabled={busy} onClick={()=>{if(confirm("سحب صلاحية المشرف من هذا الحساب وإعادته لمستخدم عادي؟"))void updateProfile(p,"role","user");}}>سحب صلاحية المشرف</button></td></tr>)}
    </tbody></table></div>
    {!profiles.some(p=>p.role==="admin")&&<p className={styles.empty}>لا يوجد مشرفون حاليًا.</p>}
    <div className={styles.panel}><h3>حدود الصلاحيات</h3><p className={styles.hint}>المشرف يدير المستخدمين العاديين والخدمات والطلبات والمفاتيح والحوادث والصيانة والتحليلات. لا يستطيع ترقية مشرف آخر أو تعديله أو سحب صلاحيته، ولا يستطيع تغيير صلاحيات المالك. إدارة المشرفين محصورة بالمالك.</p></div>
   </section>}
   {tab==="services"&&<section className={styles.panel}><div className={styles.toolbar}><h2>كتالوج الخدمات وإصداراتها</h2><div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث عن خدمة"/><button className={styles.primary} onClick={()=>{setServiceForm(blankService);setShowServiceForm(true)}}>إضافة خدمة</button></div></div>{showServiceForm&&<div className={styles.form}><div className={styles.formGrid}><label>الاسم<input value={serviceForm.name} onChange={e=>setServiceForm({...serviceForm,name:e.target.value})}/></label><label>المعرّف (slug)<input value={serviceForm.slug} onChange={e=>setServiceForm({...serviceForm,slug:e.target.value})}/></label><label>المجال<input value={serviceForm.category} onChange={e=>setServiceForm({...serviceForm,category:e.target.value})}/></label><label>المسار الداخلي<input value={serviceForm.endpoint_path} onChange={e=>setServiceForm({...serviceForm,endpoint_path:e.target.value})} placeholder="/api/v1/..."/></label><label>HTTP Method<select value={serviceForm.http_method} onChange={e=>setServiceForm({...serviceForm,http_method:e.target.value})}>{["GET","POST","PUT","PATCH","DELETE"].map(x=><option key={x}>{x}</option>)}</select></label><label>وزن الخدمة (1–100)<input type="number" min="1" max="100" value={serviceForm.weight} onChange={e=>setServiceForm({...serviceForm,weight:Number(e.target.value)})}/></label><label>الحالة<select value={serviceForm.status} onChange={e=>setServiceForm({...serviceForm,status:e.target.value})}><option value="active">نشطة</option><option value="maintenance">صيانة</option><option value="disabled">معطلة</option></select></label></div><label>الوصف<textarea value={serviceForm.description} onChange={e=>setServiceForm({...serviceForm,description:e.target.value})}/></label><label>التوثيق Markdown<textarea value={serviceForm.docs_markdown} onChange={e=>setServiceForm({...serviceForm,docs_markdown:e.target.value})}/></label><div className={styles.actions}><button onClick={()=>setShowServiceForm(false)}>إلغاء</button><button className={styles.primary} disabled={busy} onClick={()=>void saveService()}>حفظ ونشر</button></div></div>}{versionService&&<div className={styles.form}><div className={styles.toolbar}><h3>إصدارات {versionService.name}</h3><button onClick={()=>{setVersionService(null);setServiceVersions([])}}>إغلاق</button></div>{serviceVersions.map(v=><div className={styles.auditRow} key={v.id}><b>v{v.version}</b><span>{v.changeNote||"—"}</span><time>{date(v.createdAt)}</time><button disabled={busy||v.version===versionService.current_version} onClick={()=>void rollbackServiceVersion(v)}>استرجاع هذا الإصدار</button></div>)}</div>}<div className={styles.tableWrap}><table><thead><tr><th>الخدمة</th><th>المسار</th><th>الحالة</th><th>الوزن</th><th>الإصدار</th><th>إجراء</th></tr></thead><tbody>{filteredServices.map(s=><tr key={s.id}><td><b>{s.name}</b><small>{s.slug}</small></td><td dir="ltr">{s.http_method} {s.endpoint_path}</td><td>{s.archived_at?"مؤرشفة":label(s.status)}</td><td>{s.weight||1}</td><td>v{s.current_version||1}</td><td><div className={styles.actions}><button onClick={()=>{setServiceForm({...s});setShowServiceForm(true)}}>تعديل</button><button onClick={()=>void loadServiceVersions(s)}>الإصدارات</button><button onClick={()=>void archiveService(s)}>{s.archived_at?"استعادة":"أرشفة"}</button></div></td></tr>)}</tbody></table></div></section>}
   {tab==="plans"&&<section className={styles.panel}><h2>حدود مستويات المستخدمين</h2><p className={styles.hint}>هذه القيم هي الإعدادات الأساسية لكل مستوى، ويُحتسب الحد على Weighted Usage وليس عدد الطلبات الخام فقط. تجاوز الحدود يرسل تحذيرات ولا يوقف الطلبات.</p>{plans.map(p=><PlanEditor key={p.plan} plan={p} busy={busy} onSave={savePlan}/>)}{adminLimit&&<AdminLimitEditor value={adminLimit} busy={busy} onSave={saveAdminLimit}/>}</section>}
   {tab==="keys"&&<section className={styles.panel}><div className={styles.toolbar}><h2>إدارة مفاتيح المستخدمين</h2><div><input value={keyQuery} onChange={e=>setKeyQuery(e.target.value)} placeholder="بحث بالمستخدم أو المفتاح"/><select value={keyStatus} onChange={e=>setKeyStatus(e.target.value)}><option value="all">كل المفاتيح</option><option value="active">نشطة</option><option value="expired">منتهية</option></select></div></div>
    {keyForm.id&&<div className={styles.form}><h3>تعديل المفتاح</h3><div className={styles.formGrid}><label>اسم المفتاح<input value={keyForm.label} onChange={e=>setKeyForm({...keyForm,label:e.target.value})}/></label><label>تاريخ الانتهاء<input type="date" value={keyForm.expiresAt} onChange={e=>setKeyForm({...keyForm,expiresAt:e.target.value})}/></label></div><label>Scopes مفصولة بفواصل<input value={keyForm.scopes} onChange={e=>setKeyForm({...keyForm,scopes:e.target.value})} placeholder="api:use, service:aql-gemini"/></label><p className={styles.hint}>استخدم api:use دائمًا، ويمكن تقييد المفتاح بخدمة مثل service:aql-gemini أو مجال مثل category:ai.</p><div className={styles.actions}><button onClick={()=>setKeyForm({id:"",label:"",expiresAt:"",scopes:"api:use"})}>إلغاء</button><button className={styles.primary} disabled={busy} onClick={()=>void saveAdminKey()}>حفظ التعديلات</button></div></div>}
    <div className={styles.tableWrap}><table><thead><tr><th>صاحب المفتاح</th><th>المفتاح</th><th>الصلاحيات</th><th>آخر استخدام</th><th>الانتهاء</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{filteredKeys.map(k=><tr key={k.id}><td><b>{k.displayName||"بدون اسم"}</b><small>{k.email}</small></td><td><b>{k.label}</b><small dir="ltr">{k.keyPrefix}••••</small></td><td><small>{k.scopes.join(" · ")}</small></td><td>{date(k.lastUsedAt)}</td><td>{date(k.expiresAt)}</td><td>{k.expiresAt&&new Date(k.expiresAt)<=new Date()?"منتهي":"نشط"}</td><td><div className={styles.actions}><button disabled={busy} onClick={()=>setKeyForm({id:k.id,label:k.label,expiresAt:k.expiresAt?.slice(0,10)||"",scopes:k.scopes.join(", ")})}>تعديل</button><button disabled={busy} onClick={()=>void deleteAdminKey(k)}>حذف نهائي</button></div></td></tr>)}</tbody></table></div>{!filteredKeys.length&&<p className={styles.empty}>لا توجد مفاتيح مطابقة.</p>}</section>}
   {tab==="analytics"&&<section className={styles.panel}>
     <div className={styles.toolbar}><div><h2>سجلات طلبات API</h2><p className={styles.hint}>سجلات آخر 24 ساعة كحد أقصى وفق سياسة الاحتفاظ. لا يتم عرض عناوين IP أو بيانات الأجهزة.</p></div><div className={styles.actions}><button onClick={()=>exportRequestLogs("csv")} disabled={!requestLogs.length}>CSV</button><button onClick={()=>exportRequestLogs("json")} disabled={!requestLogs.length}>JSON</button></div></div>
     <div className={styles.formGrid}>
      <label>الفترة<select value={requestLogsHours} onChange={e=>{setRequestLogsHours(Number(e.target.value));setRequestLogsPage(1)}}><option value="1">آخر ساعة</option><option value="6">آخر 6 ساعات</option><option value="24">آخر 24 ساعة</option></select></label>
      <label>الخدمة<select value={requestLogsService} onChange={e=>{setRequestLogsService(e.target.value);setRequestLogsPage(1)}}><option value="">كل الخدمات</option>{services.map(x=><option key={x.id} value={x.slug}>{x.name}</option>)}</select></label>
      <label>المستخدم<select value={requestLogsUser} onChange={e=>{setRequestLogsUser(e.target.value);setRequestLogsPage(1)}}><option value="">كل المستخدمين</option>{profiles.map(x=><option key={x.id} value={x.id}>{x.display_name||x.email||x.id}</option>)}</select></label>
      <label>النتيجة<select value={requestLogsResult} onChange={e=>{setRequestLogsResult(e.target.value);setRequestLogsPage(1)}}><option value="all">كل الطلبات</option><option value="success">ناجحة</option><option value="error">فاشلة</option></select></label>
      <label>HTTP Status<input type="number" min="100" max="599" placeholder="كل الحالات" value={requestLogsStatus} onChange={e=>{setRequestLogsStatus(e.target.value);setRequestLogsPage(1)}}/></label>
      <div className={styles.actions}><button className={styles.primary} onClick={()=>void loadRequestLogs(1)} disabled={busy}>تطبيق الفلاتر</button><button onClick={()=>{setRequestLogsService("");setRequestLogsUser("");setRequestLogsResult("all");setRequestLogsStatus("");setRequestLogsHours(24);setRequestLogsPage(1)}}>إعادة ضبط</button></div>
     </div>
     <div className={styles.toolbar}><strong>{requestLogsTotal.toLocaleString("en-US")} طلب</strong><span className={styles.hint}>الصفحة {requestLogsPage} من {requestLogsTotalPages}</span></div>
     <div className={styles.tableWrap}><table><thead><tr><th>التوقيت</th><th>المستخدم</th><th>المفتاح</th><th>الخدمة / Method</th><th>HTTP</th><th>الزمن</th><th>الوزن</th></tr></thead><tbody>
      {requestLogs.map(x=><tr key={x.id}><td>{date(x.createdAt)}</td><td><b>{x.displayName||"حساب"}</b><small>{x.email||x.userId||"—"}</small></td><td>{x.keyLabel||"—"}</td><td><b>{x.service}</b><small dir="ltr">{x.method}</small></td><td>{x.status??"—"}</td><td>{x.latency===null?"—":x.latency+" ms"}</td><td>{x.weight}</td></tr>)}
     </tbody></table></div>
     {!requestLogs.length&&<p className={styles.empty}>لا توجد طلبات مطابقة للفلاتر في الفترة المحددة.</p>}
     <div className={styles.actions}><button disabled={busy||requestLogsPage<=1} onClick={()=>void loadRequestLogs(requestLogsPage-1)}>السابق</button><button disabled={busy||requestLogsPage>=requestLogsTotalPages} onClick={()=>void loadRequestLogs(requestLogsPage+1)}>التالي</button></div>
    </section>}
   {tab==="audit"&&<section className={styles.panel}>
     <div className={styles.toolbar}><div><h2>سجل التدقيق الإداري</h2><p className={styles.hint}>يسجل التغييرات الإدارية المهمة، ولا يتضمن كلمات المرور أو مفاتيح API السرية.</p></div><div className={styles.actions}><button onClick={()=>exportAuditLogs("csv")} disabled={!auditRows.length}>CSV الصفحة</button><button onClick={()=>exportAuditLogs("json")} disabled={!auditRows.length}>JSON الصفحة</button></div></div>
     <div className={styles.formGrid}>
      <label>الفترة<select value={auditHours} onChange={e=>setAuditHours(Number(e.target.value))}><option value="0">كل السجل</option><option value="24">24 ساعة</option><option value="168">7 أيام</option><option value="720">30 يوماً</option></select></label>
      <label>المنفذ<select value={auditActor} onChange={e=>setAuditActor(e.target.value)}><option value="">كل المنفذين</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name||p.email||p.id}</option>)}</select></label>
      <label>نوع العملية<input value={auditAction} onChange={e=>setAuditAction(e.target.value)} placeholder="مثال: profile.admin_update"/></label>
      <label>نوع العنصر<input value={auditEntityType} onChange={e=>setAuditEntityType(e.target.value)} placeholder="مثال: api_service"/></label>
      <label>بحث عام<input value={auditQuery} onChange={e=>setAuditQuery(e.target.value)} placeholder="بحث في التفاصيل والمعرفات"/></label>
      <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void loadAuditLogs(1)}>تطبيق الفلاتر</button><button onClick={()=>{setAuditHours(0);setAuditActor("");setAuditAction("");setAuditEntityType("");setAuditQuery("");}}>إعادة ضبط</button></div>
     </div>
     <div className={styles.toolbar}><strong>{auditRowsTotal.toLocaleString("en-US")} عملية</strong><span className={styles.hint}>الصفحة {auditRowsPage} من {auditRowsTotalPages}</span></div>
     {auditRows.map(a=><div className={styles.auditRow} key={a.id}><b>{a.action}</b><span>{a.entityType} · {a.entityId||"—"}</span><small>{a.actorName||"حساب غير متاح"} · {a.actorEmail||a.actorId||"—"}</small><small>{JSON.stringify(a.details||{})}</small><time>{date(a.createdAt)}</time></div>)}
     {!auditRows.length&&<p className={styles.empty}>لا توجد عمليات مطابقة للفلاتر.</p>}
     <div className={styles.actions}><button disabled={busy||auditRowsPage<=1} onClick={()=>void loadAuditLogs(auditRowsPage-1)}>السابق</button><button disabled={busy||auditRowsPage>=auditRowsTotalPages} onClick={()=>void loadAuditLogs(auditRowsPage+1)}>التالي</button></div>
    </section>}{tab==="monitor"&&<section className={styles.panel}><h2>إدارة الحوادث</h2><p className={styles.hint}>التحديثات والوصف الأولي تظهر في صفحة الحالة العامة. لا تضع أسرارًا أو تفاصيل تشخيص داخلية هنا.</p>
    <div className={styles.form}>
     <label>عنوان الحادث<input value={incidentForm.title} onChange={e=>setIncidentForm({...incidentForm,title:e.target.value})}/></label>
     <label>الوصف الأولي (يظهر في صفحة الحالة العامة)<textarea value={incidentForm.description} onChange={e=>setIncidentForm({...incidentForm,description:e.target.value})}/></label>
     <div className={styles.formGrid}>
      <label>الخطورة<select value={incidentForm.severity} onChange={e=>setIncidentForm({...incidentForm,severity:e.target.value})}><option value="minor">منخفض</option><option value="major">مرتفع</option><option value="critical">حرج</option></select></label>
      <label>الحالة<select value={incidentForm.status} onChange={e=>setIncidentForm({...incidentForm,status:e.target.value})}><option value="investigating">قيد التحقيق</option><option value="identified">تم تحديد السبب</option><option value="monitoring">تحت المراقبة</option></select></label>
     </div>
     <label>الخدمات المتأثرة</label><div className={styles.formGrid}>{services.filter(x=>!x.archived_at).map(x=><label className={styles.check} key={x.id}><input type="checkbox" checked={incidentForm.affected_services.includes(x.slug)} onChange={e=>setIncidentForm(v=>({...v,affected_services:e.target.checked?[...v.affected_services,x.slug]:v.affected_services.filter(y=>y!==x.slug)}))}/>{x.name}</label>)}</div>
     <button className={styles.primary} disabled={busy||!incidentForm.title.trim()} onClick={()=>void createIncident()}>تسجيل حادث</button>
    </div>
    {incidents.map(i=><article className={styles.panel} key={i.id}>
     <div className={styles.toolbar}><div><b>{i.title}</b><p className={styles.hint}>{label(i.severity)} · {label(i.status)} · {date(i.started_at)}</p></div>
      <select value={i.status} disabled={busy} onChange={e=>void changeIncident(i,e.target.value)}><option value="investigating">قيد التحقيق</option><option value="identified">تم تحديد السبب</option><option value="monitoring">تحت المراقبة</option><option value="resolved">تم الحل</option></select>
     </div>
     <p>{i.description}</p>
     <p className={styles.hint}>الخدمات المتأثرة: {i.affected_services.map(slug=>services.find(x=>x.slug===slug)?.name||slug).join("، ")||"لا توجد خدمات محددة"}</p>
     <div className={styles.form}><label>إضافة تحديث أو ملاحظة<textarea value={incidentUpdateNotes[i.id]||""} onChange={e=>setIncidentUpdateNotes(v=>({...v,[i.id]:e.target.value}))} placeholder="اكتب تحديثًا عامًا للمستخدمين عن الحالة أو التقدم في الحل"/></label><button disabled={busy||!incidentUpdateNotes[i.id]?.trim()} onClick={()=>void addIncidentUpdate(i)}>إضافة تحديث</button></div>
     <h4>سجل التحديثات</h4>
     {incidentUpdates.filter(u=>u.incident_id===i.id).map(u=><div className={styles.auditRow} key={u.id}><span>{u.status?label(u.status):"تحديث"}</span><p>{u.message}</p><time>{date(u.created_at)}</time></div>)}
    </article>)}
   </section>}
   {tab==="services"&&<section className={styles.panel}>
    <div className={styles.toolbar}><div><h2>اعتماديات الخدمات</h2><p className={styles.hint}>حدد الخدمات التي تعتمد عليها كل خدمة. يمنع النظام إنشاء علاقات دائرية تلقائياً.</p></div></div>
    <div className={styles.form}>
     <div className={styles.formGrid}>
      <label>الخدمة الأساسية<select value={dependencyForm.service_id} onChange={e=>setDependencyForm({...dependencyForm,service_id:e.target.value})}><option value="">اختر الخدمة</option>{services.filter(s=>!s.archived_at).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>تعتمد على<select value={dependencyForm.depends_on_service_id} onChange={e=>setDependencyForm({...dependencyForm,depends_on_service_id:e.target.value})}><option value="">اختر الاعتمادية</option>{services.filter(s=>!s.archived_at&&s.id!==dependencyForm.service_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>نوع الاعتماد<select value={dependencyForm.dependency_type} onChange={e=>setDependencyForm({...dependencyForm,dependency_type:e.target.value as "required"|"optional"})}><option value="required">إلزامي</option><option value="optional">اختياري</option></select></label>
     </div>
     <label>ملاحظات<textarea value={dependencyForm.description} onChange={e=>setDependencyForm({...dependencyForm,description:e.target.value})} placeholder="سبب الاعتماد أو تفاصيله"/></label>
     <button className={styles.primary} disabled={busy||!dependencyForm.service_id||!dependencyForm.depends_on_service_id} onClick={()=>void saveDependency()}>إضافة الاعتمادية</button>
    </div>
    <div className={styles.tableWrap}><table><thead><tr><th>الخدمة</th><th>تعتمد على</th><th>النوع</th><th>الوصف</th><th>الإجراء</th></tr></thead><tbody>
     {dependencies.map(d=><tr key={d.id}><td>{services.find(x=>x.id===d.service_id)?.name||"خدمة محذوفة"}</td><td>{services.find(x=>x.id===d.depends_on_service_id)?.name||"خدمة محذوفة"}</td><td>{d.dependency_type==="required"?"إلزامي":"اختياري"}</td><td>{d.description||"—"}</td><td><button disabled={busy} onClick={()=>void deleteDependency(d)}>حذف</button></td></tr>)}
    </tbody></table></div>
    {!dependencies.length&&<p className={styles.empty}>لم يتم تعريف اعتماديات بعد.</p>}
   </section>}
   {tab==="monitor"&&<section className={styles.panel}><h2>وضع الصيانة</h2><div className={styles.form}><label>النطاق<select value={maintenanceForm.service_id} onChange={e=>setMaintenanceForm({...maintenanceForm,service_id:e.target.value})}><option value="">كل الخدمات (عام)</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>رسالة الصيانة<textarea value={maintenanceForm.message} onChange={e=>setMaintenanceForm({...maintenanceForm,message:e.target.value})}/></label><div className={styles.formGrid}><label>البداية<input type="datetime-local" value={maintenanceForm.starts_at} onChange={e=>setMaintenanceForm({...maintenanceForm,starts_at:e.target.value})}/></label><label>النهاية<input type="datetime-local" value={maintenanceForm.ends_at} onChange={e=>setMaintenanceForm({...maintenanceForm,ends_at:e.target.value})}/></label></div><label className={styles.check}><input type="checkbox" checked={maintenanceForm.enabled} onChange={e=>setMaintenanceForm({...maintenanceForm,enabled:e.target.checked})}/> تفعيل الصيانة عند الحفظ</label><button className={styles.primary} onClick={()=>void saveMaintenance()}>حفظ إعداد الصيانة</button></div>{maintenance.map(m=><div className={styles.auditRow} key={m.id}><b>{m.service_id?services.find(s=>s.id===m.service_id)?.name||"خدمة":"كل الخدمات"}</b><span>{m.message}</span><time>{m.enabled?"مفعلة":"متوقفة"}</time><button onClick={()=>void markMaintenance(m)}>{m.enabled?"إيقاف":"تفعيل"}</button></div>)}</section>}
     </section>
 </div>;
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
