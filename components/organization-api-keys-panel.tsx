"use client";

import {useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";

type Project={id:string;name:string};
type ApiKey={id:string;user_id:string;user_name:string|null;user_email:string|null;label:string;key_prefix:string;created_at:string;last_used_at:string|null;expires_at:string|null;revoked_at:string|null;project_id:string|null;project_name:string|null};
type PendingAction={kind:"create"}|{kind:"revoke";id:string};
const field:React.CSSProperties={display:"grid",gap:6,minWidth:0};
const input:React.CSSProperties={width:"100%",padding:"10px 12px",border:"1px solid var(--border,#34343b)",borderRadius:9,background:"var(--input,#17171d)",color:"inherit"};
const muted:React.CSSProperties={fontSize:13,opacity:.72};
const cell:React.CSSProperties={padding:10,borderBottom:"1px solid var(--border,#333)",fontSize:13,textAlign:"right"};
export default function OrganizationApiKeysPanel({organizationId}:{organizationId:string}){
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [userId,setUserId]=useState("");
 const [role,setRole]=useState("");
 const [projects,setProjects]=useState<Project[]>([]);
 const [keys,setKeys]=useState<ApiKey[]>([]);
 const [projectId,setProjectId]=useState("");
 const [label,setLabel]=useState("");
 const [expiry,setExpiry]=useState("30");
 const [createdKey,setCreatedKey]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mfaOpen,setMfaOpen]=useState(false);
 const [mfaCode,setMfaCode]=useState("");
 const [mfaError,setMfaError]=useState("");
 const [mfaFactorId,setMfaFactorId]=useState("");
 const [mfaChallengeId,setMfaChallengeId]=useState("");
 const [pending,setPending]=useState<PendingAction|null>(null);

 const load=useCallback(async()=>{
  if(!db)return;
  setLoading(true);setError("");
  const {data:{user},error:userError}=await db.auth.getUser();
  if(userError||!user){setError("انتهت جلسة الحساب. سجّل الدخول مجددًا.");setLoading(false);return}
  setUserId(user.id);
  const [projectResult,keyResult,memberResult,projectMemberResult]=await Promise.all([
   db.from("projects").select("id,name").eq("organization_id",organizationId).order("created_at",{ascending:true}),
   db.rpc("bmg_list_organization_api_keys",{p_organization_id:organizationId}),
   db.from("organization_members").select("role").eq("organization_id",organizationId).eq("user_id",user.id).maybeSingle(),
   db.from("project_members").select("project_id,role").eq("user_id",user.id)
  ]);
  if(projectResult.error)setError(projectResult.error.message);else{
   const membership=memberResult.data?.role||"";
   const projectMemberships=projectMemberResult.data||[];
   const allowed=(projectResult.data||[]).filter(project=>
    ["owner","admin"].includes(membership)||
    projectMemberships.some(item=>item.project_id===project.id&&["owner","developer"].includes(item.role))
   ) as Project[];
   setProjects(allowed);
   if(allowed.length)setProjectId(current=>allowed.some(item=>item.id===current)?current:allowed[0].id);
  }
  if(keyResult.error)setError(current=>current?current+" · "+keyResult.error.message:keyResult.error.message);
  else setKeys((keyResult.data||[]) as ApiKey[]);
  setRole((memberResult.data?.role||"") as string);
  setLoading(false);
 },[db,organizationId]);
 useEffect(()=>{void load()},[load]);

 async function beginMfa(action:PendingAction){
  if(!db||busy)return;
  setBusy(true);setError("");setNotice("");setMfaError("");
  const {data:factors,error:factorsError}=await db.auth.mfa.listFactors();
  if(factorsError){setError(factorsError.message);setBusy(false);return}
  const factor=factors?.totp?.find(item=>item.status==="verified");
  if(!factor){setError("يجب تفعيل المصادقة الثنائية من إعدادات الحساب قبل إدارة مفاتيح المؤسسة.");setBusy(false);return}
  const {data:challenge,error:challengeError}=await db.auth.mfa.challenge({factorId:factor.id});
  if(challengeError){setError(challengeError.message);setBusy(false);return}
  setPending(action);setMfaFactorId(factor.id);setMfaChallengeId(challenge.id);setMfaCode("");setMfaOpen(true);setBusy(false);
 }
 async function performCreate(){
  if(!db)return;
  const bytes=new Uint8Array(39);crypto.getRandomValues(bytes);
  const binary=Array.from(bytes,b=>String.fromCharCode(b)).join("");
  const token=btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const raw="nox_"+token;
  const expires=expiry==="never"?null:new Date(Date.now()+Number(expiry)*86400000).toISOString();
  const {error}=await db.rpc("bmg_create_api_key",{p_key:raw,p_label:label.trim(),p_project_id:projectId,...(expires?{p_expires_at:expires}:{})});
  if(error){setError(error.message.includes("API key limit reached")?"وصلت إلى الحد الأقصى لمفاتيح API في حسابك.":error.message);return}
  setCreatedKey(raw);setLabel("");setNotice("تم إنشاء مفتاح للمؤسسة. انسخ قيمته الآن؛ لن تظهر كاملة مرة أخرى.");await load();
 }
 async function performRevoke(id:string){
  if(!db)return;
  const {data,error}=await db.rpc("bmg_revoke_organization_api_key",{p_id:id});
  if(error)setError(error.message);
  else if(!data)setError("لم يتم إلغاء المفتاح؛ ربما تم إلغاؤه مسبقًا.");
  else{setNotice("تم إلغاء المفتاح مع الاحتفاظ بسجل استهلاكه.");await load()}
 }
 async function verifyMfa(){
  if(!db||!pending||mfaCode.length!==6)return;
  setBusy(true);setMfaError("");
  const {error}=await db.auth.mfa.verify({factorId:mfaFactorId,challengeId:mfaChallengeId,code:mfaCode});
  if(error){setMfaError(error.message==="Invalid TOTP code entered"?"رمز التحقق غير صحيح. أدخل الرمز الحالي من تطبيق المصادقة.":error.message);setBusy(false);return}
  const action=pending;setMfaOpen(false);setPending(null);setMfaCode("");
  if(action.kind==="create")await performCreate();else await performRevoke(action.id);
  setBusy(false);
 }
 async function retryChallenge(){
  if(!db||!mfaFactorId)return;
  setBusy(true);setMfaError("");
  const {data,error}=await db.auth.mfa.challenge({factorId:mfaFactorId});
  if(error)setMfaError(error.message);else{setMfaChallengeId(data.id);setMfaCode("")}
  setBusy(false);
 }
 const canManageAll=["owner","admin"].includes(role);
 return <section dir="rtl" style={{display:"grid",gap:14,marginTop:14}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
   <div><h3 style={{margin:"0 0 5px"}}>مفاتيح API للمؤسسة</h3><p style={muted}>المفاتيح مرتبطة بمشاريع هذه المؤسسة، واستهلاكها يُخصم من حصة المؤسسة المشتركة.</p></div>
   <button type="button" disabled={busy||loading} onClick={()=>void load()} style={{padding:"9px 12px",border:"1px solid var(--border,#444)",borderRadius:8,background:"transparent",color:"inherit"}}>تحديث</button>
  </header>
  {error&&<div role="alert" style={{padding:11,borderRadius:9,background:"rgba(220,50,50,.12)"}}>{error}</div>}
  {notice&&<div role="status" style={{padding:11,borderRadius:9,background:"rgba(40,160,100,.12)"}}>{notice}</div>}
  <section style={{border:"1px solid var(--border,#34343b)",borderRadius:12,padding:14,display:"grid",gap:12}}>
   <h4 style={{margin:0}}>إنشاء مفتاح للمؤسسة</h4>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
    <label style={field}>اسم المفتاح<input style={input} value={label} onChange={e=>setLabel(e.target.value)} maxLength={64} placeholder="مثال: خدمة الإنتاج"/></label>
    <label style={field}>المشروع<select style={input} value={projectId} onChange={e=>setProjectId(e.target.value)} disabled={!projects.length}><option value="">اختر مشروعًا</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    <label style={field}>الصلاحية<select style={input} value={expiry} onChange={e=>setExpiry(e.target.value)}><option value="7">7 أيام</option><option value="30">30 يومًا</option><option value="90">90 يومًا</option><option value="365">سنة</option><option value="never">دون انتهاء</option></select></label>
   </div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><button type="button" disabled={busy||!label.trim()||!projectId||loading} onClick={()=>void beginMfa({kind:"create"})} style={{padding:"10px 14px",border:0,borderRadius:9,background:"var(--accent,#7046d8)",color:"#fff"}}>إنشاء مفتاح</button><small style={muted}>يتطلب تحققًا حديثًا بالمصادقة الثنائية.</small></div>
   {!projects.length&&!loading&&<p style={muted}>لا توجد مشاريع تملك صلاحية إنشاء مفاتيح لها في هذه المؤسسة.</p>}
   {createdKey&&<div style={{display:"grid",gap:8,padding:12,borderRadius:9,border:"1px solid var(--border,#444)"}}><b>المفتاح الجديد — انسخه الآن</b><code dir="ltr" style={{overflowWrap:"anywhere"}}>{createdKey}</code><button type="button" onClick={()=>void navigator.clipboard.writeText(createdKey)} style={{justifySelf:"start",padding:"8px 12px",borderRadius:8,border:"1px solid var(--border,#444)",background:"transparent",color:"inherit"}}>نسخ المفتاح</button></div>}
  </section>
  <section style={{border:"1px solid var(--border,#34343b)",borderRadius:12,padding:14,display:"grid",gap:10}}>
   <h4 style={{margin:0}}>مفاتيح المؤسسة ({keys.length})</h4>
   {loading?<p style={muted}>جارٍ تحميل المفاتيح…</p>:!keys.length?<p style={muted}>لا توجد مفاتيح API مرتبطة بهذه المؤسسة.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:650}}><thead><tr>{["الاسم","المشروع","صاحب المفتاح","البادئة","آخر استخدام","الحالة","الإجراء"].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>{keys.map(key=>{
    const expired=!!key.expires_at&&new Date(key.expires_at)<=new Date();
    const active=!key.revoked_at&&!expired;
    const canRevoke=active&&(canManageAll||key.user_id===userId);
    return <tr key={key.id}><td style={cell}>{key.label}</td><td style={cell}>{key.project_name||"—"}</td><td style={cell}>{key.user_name||key.user_email||"عضو"}</td><td style={cell}><code dir="ltr">{key.key_prefix}••••</code></td><td style={cell}>{key.last_used_at?new Date(key.last_used_at).toLocaleString("ar-EG"):"لم يستخدم"}</td><td style={cell}>{key.revoked_at?"ملغى":expired?"منتهي":"نشط"}</td><td style={cell}>{canRevoke?<button type="button" disabled={busy} onClick={()=>{if(confirm("سيتم إلغاء المفتاح مع الاحتفاظ بسجل الاستهلاك. هل تريد المتابعة؟"))void beginMfa({kind:"revoke",id:key.id})}} style={{padding:"7px 10px",borderRadius:7,border:"1px solid var(--border,#444)",background:"transparent",color:"inherit"}}>إلغاء</button>:"—"}</td></tr>;
   })}</tbody></table></div>}
  </section>
  {mfaOpen&&<div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.7)",display:"grid",placeItems:"center",padding:16}}><section style={{width:"min(100%,420px)",background:"var(--panel,#1b1b22)",border:"1px solid var(--border,#444)",borderRadius:14,padding:18,display:"grid",gap:12}}><h3 style={{margin:0}}>التحقق بخطوتين</h3><p style={muted}>أدخل الرمز الحالي من تطبيق المصادقة للمتابعة.</p><input style={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/>{mfaError&&<p role="alert">{mfaError}</p>}<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" disabled={busy} onClick={retryChallenge}>رمز جديد</button><button type="button" disabled={busy} onClick={()=>{setMfaOpen(false);setPending(null)}}>إلغاء</button><button type="button" disabled={busy||mfaCode.length!==6} onClick={()=>void verifyMfa()}>تحقق ومتابعة</button></div></section></div>}
 </section>;
}
