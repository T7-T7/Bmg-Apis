"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";

type Organization={id:string;name:string;kind:string};
type Project={id:string;organization_id:string;name:string;slug:string};
type LimitRow={organization_id?:string;project_id?:string;service_slug:string;requests_per_minute:number;daily_weighted_limit:number|null;monthly_weighted_limit:number|null;updated_at?:string;updated_by?:string|null};
type FormValue={requests_per_minute:string;daily_weighted_limit:string;monthly_weighted_limit:string};
const emptyForm:FormValue={requests_per_minute:"60",daily_weighted_limit:"",monthly_weighted_limit:""};
const fieldStyle:React.CSSProperties={display:"grid",gap:6,minWidth:0};
const inputStyle:React.CSSProperties={width:"100%",minWidth:0,padding:"10px 12px",border:"1px solid var(--border, #34343b)",borderRadius:9,background:"var(--input, #17171d)",color:"inherit"};
const panelStyle:React.CSSProperties={border:"1px solid var(--border, #34343b)",borderRadius:12,padding:16,display:"grid",gap:14,marginTop:16};
const buttonStyle:React.CSSProperties={padding:"10px 14px",borderRadius:9,border:"1px solid var(--border, #444)",background:"var(--accent, #7046d8)",color:"#fff",cursor:"pointer"};
const numberOrNull=(value:string)=>value.trim()===""?null:Number(value);
const validNumber=(value:string,nullable:boolean)=>{if(nullable&&value.trim()==="")return true;const n=Number(value);return Number.isSafeInteger(n)&&n>0};
export default function ManagedScopeLimits(){
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [projects,setProjects]=useState<Project[]>([]);
 const [services,setServices]=useState<{slug:string;name:string}[]>([]);
 const [orgId,setOrgId]=useState("");
 const [projectId,setProjectId]=useState("");
 const [serviceSlug,setServiceSlug]=useState("");
 const [scope,setScope]=useState<"organization"|"project">("organization");
 const [form,setForm]=useState<FormValue>(emptyForm);
 const [rows,setRows]=useState<LimitRow[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const selectedProjects=useMemo(()=>projects.filter(p=>p.organization_id===orgId),[projects,orgId]);
 const load=useCallback(async()=>{
  if(!db)return;
  setBusy(true);setError("");
  const [orgResult,projectResult,serviceResult]=await Promise.all([
   db.from("organizations").select("id,name,kind").order("name"),
   db.from("projects").select("id,organization_id,name,slug").order("name"),
   db.from("api_services").select("slug,name").is("archived_at",null).order("name")
  ]);
  const failed=[orgResult,projectResult,serviceResult].find(x=>x.error);
  if(failed?.error){setError(failed.error.message);setBusy(false);return}
  const orgs=(orgResult.data||[]) as Organization[];
  const projs=(projectResult.data||[]) as Project[];
  const svcs=(serviceResult.data||[]) as {slug:string;name:string}[];
  setOrganizations(orgs);setProjects(projs);setServices(svcs);
  if(!orgId&&orgs.length)setOrgId(orgs[0].id);
  if(!serviceSlug&&svcs.length)setServiceSlug(svcs[0].slug);
  setBusy(false);
 },[db,orgId,serviceSlug]);
 const loadRows=useCallback(async()=>{
  if(!db||!orgId)return;
  setBusy(true);setError("");
  const result=scope==="organization"
   ?await db.from("organization_service_limits").select("organization_id,service_slug,requests_per_minute,daily_weighted_limit,monthly_weighted_limit,updated_at,updated_by").eq("organization_id",orgId).order("service_slug")
   :projectId?await db.from("project_service_limits").select("project_id,service_slug,requests_per_minute,daily_weighted_limit,monthly_weighted_limit,updated_at,updated_by").eq("project_id",projectId).order("service_slug"):null;
  if(result?.error)setError(result.error.message);else setRows((result?.data||[]) as LimitRow[]);
  setBusy(false);
 },[db,orgId,projectId,scope]);
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(scope==="project"&&!projectId&&selectedProjects.length)setProjectId(selectedProjects[0].id)},[scope,projectId,selectedProjects]);
 useEffect(()=>{if(orgId&&(scope==="organization"||projectId))void loadRows()},[orgId,projectId,scope,loadRows]);
 useEffect(()=>{
  const current=rows.find(x=>x.service_slug===serviceSlug);
  setForm(current?{requests_per_minute:String(current.requests_per_minute),daily_weighted_limit:current.daily_weighted_limit===null?"":String(current.daily_weighted_limit),monthly_weighted_limit:current.monthly_weighted_limit===null?"":String(current.monthly_weighted_limit)}:emptyForm);
 },[rows,serviceSlug]);
 async function save(){
  if(!db||!orgId||!serviceSlug||(scope==="project"&&!projectId))return;
  if(!validNumber(form.requests_per_minute,false)||!validNumber(form.daily_weighted_limit,true)||!validNumber(form.monthly_weighted_limit,true)){setError("أدخل أعدادًا صحيحة موجبة، أو اترك حد اليوم/الشهر فارغًا لإلغاء ذلك الحد.");return}
  setBusy(true);setError("");setNotice("");
  const args={p_service_slug:serviceSlug,p_requests_per_minute:Number(form.requests_per_minute),p_daily_weighted_limit:numberOrNull(form.daily_weighted_limit),p_monthly_weighted_limit:numberOrNull(form.monthly_weighted_limit)};
  const result=scope==="organization"
   ?await db.rpc("bmg_admin_set_organization_service_limits",{p_organization_id:orgId,...args})
   :await db.rpc("bmg_admin_set_project_service_limits",{p_project_id:projectId,...args});
  if(result.error)setError(result.error.message);else{setNotice("تم حفظ حدود النطاق وتسجيل التغيير في سجل التدقيق.");await loadRows()}
  setBusy(false);
 }

 return <section style={{display:"grid",gap:14}}>
  <div><h2>حدود المؤسسات والمشاريع</h2><p>تُطبق الحدود المخصصة بالإضافة إلى حدود الحساب والاشتراك؛ لا يلغي حد المؤسسة أو المشروع الحدود الأعلى الأخرى. اترك حد اليوم أو الشهر فارغًا لتعطيله في هذا النطاق.</p></div>
  {error&&<div role="alert" style={{padding:12,borderRadius:9,background:"rgba(220,50,50,.12)"}}>{error}</div>}
  {notice&&<div role="status" style={{padding:12,borderRadius:9,background:"rgba(40,160,100,.12)"}}>{notice}</div>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12}}>
   <label style={fieldStyle}>نوع النطاق<select style={inputStyle} value={scope} onChange={e=>setScope(e.target.value as "organization"|"project")}><option value="organization">مؤسسة</option><option value="project">مشروع</option></select></label>
   <label style={fieldStyle}>المؤسسة<select style={inputStyle} value={orgId} onChange={e=>{setOrgId(e.target.value);setProjectId("")}}><option value="">اختر مؤسسة</option>{organizations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   {scope==="project"&&<label style={fieldStyle}>المشروع<select style={inputStyle} value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">اختر مشروعًا</option>{selectedProjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
   <label style={fieldStyle}>الخدمة<select style={inputStyle} value={serviceSlug} onChange={e=>setServiceSlug(e.target.value)}><option value="">اختر خدمة</option>{services.map(x=><option key={x.slug} value={x.slug}>{x.name} · {x.slug}</option>)}</select></label>
  </div>
  <div style={panelStyle}>
   <h3>{scope==="organization"?"حدود المؤسسة":"حدود المشروع"} · {services.find(x=>x.slug===serviceSlug)?.name||serviceSlug||"الخدمة"}</h3>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
    <label style={fieldStyle}>Requests per minute<input style={inputStyle} type="number" min="1" step="1" value={form.requests_per_minute} onChange={e=>setForm(v=>({...v,requests_per_minute:e.target.value}))}/></label>
    <label style={fieldStyle}>Daily weighted limit<input style={inputStyle} type="number" min="1" step="1" placeholder="بدون حد مخصص" value={form.daily_weighted_limit} onChange={e=>setForm(v=>({...v,daily_weighted_limit:e.target.value}))}/></label>
    <label style={fieldStyle}>Monthly weighted limit<input style={inputStyle} type="number" min="1" step="1" placeholder="بدون حد مخصص" value={form.monthly_weighted_limit} onChange={e=>setForm(v=>({...v,monthly_weighted_limit:e.target.value}))}/></label>
   </div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" style={buttonStyle} disabled={busy||!orgId||!serviceSlug||(scope==="project"&&!projectId)} onClick={()=>void save()}>حفظ الحدود</button><button type="button" style={{...buttonStyle,background:"transparent",color:"inherit"}} disabled={busy} onClick={()=>void loadRows()}>تحديث</button></div>
   <small>آخر تحديث: {rows.find(x=>x.service_slug===serviceSlug)?.updated_at?new Date(rows.find(x=>x.service_slug===serviceSlug)!.updated_at!).toLocaleString("ar-EG"):"لا يوجد إعداد مخصص لهذه الخدمة"}</small>
  </div>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"right",padding:9}}>الخدمة</th><th style={{textAlign:"right",padding:9}}>RPM</th><th style={{textAlign:"right",padding:9}}>اليومي</th><th style={{textAlign:"right",padding:9}}>الشهري</th><th style={{textAlign:"right",padding:9}}>آخر تحديث</th></tr></thead><tbody>
   {rows.map(x=><tr key={x.service_slug}><td style={{padding:9,borderTop:"1px solid var(--border, #333)"}}>{services.find(s=>s.slug===x.service_slug)?.name||x.service_slug}</td><td style={{padding:9,borderTop:"1px solid var(--border, #333)"}}>{x.requests_per_minute}</td><td style={{padding:9,borderTop:"1px solid var(--border, #333)"}}>{x.daily_weighted_limit??"—"}</td><td style={{padding:9,borderTop:"1px solid var(--border, #333)"}}>{x.monthly_weighted_limit??"—"}</td><td style={{padding:9,borderTop:"1px solid var(--border, #333)"}}>{x.updated_at?new Date(x.updated_at).toLocaleString("ar-EG"):"—"}</td></tr>)}
   {!rows.length&&<tr><td colSpan={5} style={{padding:12,textAlign:"center"}}>لا توجد حدود مخصصة محفوظة لهذا النطاق.</td></tr>}
  </tbody></table></div>
  <p style={{opacity:.75,fontSize:13}}>كل عملية حفظ تمر عبر RPC إداري يتحقق من صلاحية المشرف/المالك ويسجل المنفذ والتوقيت في audit_logs. القيم الفارغة تلغي حد الاستهلاك اليومي أو الشهري المخصص فقط؛ ويظل حد RPM محفوظًا.</p>
 </section>;
}
