"use client";

import {useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";

type UsagePayload={
 allocation:{scopeCount:number|null;scopePosition:number|null;requestsPerMinute:number|null;dailyWeightedLimit:number|null;monthlyWeightedLimit:number|null};
 usage:{requestsPerMinute:number;dailyRequests:number;monthlyRequests:number;dailyWeightedUsage:number;monthlyWeightedUsage:number;dailyRemaining:number|null;monthlyRemaining:number|null;dailyPercentage:number|null;monthlyPercentage:number|null};
 projects:{id:string|null;name:string;requests:number;weightedUsage:number}[];
 services:{slug:string;requests:number;weightedUsage:number}[];
 recent:{id:number;projectId:string|null;service:string;method:string;status:number|null;latency:number|null;createdAt:string}[];
};
const number=(value:number|null|undefined)=>value==null?"غير محدد":value.toLocaleString("en-US");
const cardStyle:React.CSSProperties={border:"1px solid var(--border,#34343b)",borderRadius:12,padding:14,display:"grid",gap:8,minWidth:0};
const muted:React.CSSProperties={fontSize:13,opacity:.72};
const tableStyle:React.CSSProperties={width:"100%",borderCollapse:"collapse",minWidth:480};
const th:React.CSSProperties={textAlign:"right",padding:10,borderBottom:"1px solid var(--border,#333)",fontSize:13};
const td:React.CSSProperties={padding:10,borderBottom:"1px solid var(--border,#333)",fontSize:13};
function UsageMeter({label,value,limit,remaining,percentage}:{label:string;value:number;limit:number|null;remaining:number|null;percentage:number|null}){
 const pct=percentage??0;
 return <article style={cardStyle}>
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><b>{label}</b><span style={muted}>{limit===null?"لم تضبط الإدارة حدًا":number(value)+" / "+number(limit)}</span></div>
  <div style={{height:8,borderRadius:20,background:"var(--border,#333)",overflow:"hidden"}}><i style={{display:"block",height:"100%",width:Math.min(100,Math.max(0,pct))+"%",background:"var(--accent,#8058e9)",borderRadius:20}}/></div>
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><span style={muted}>المتبقي: <b>{number(remaining)}</b></span><span style={muted}>{limit===null?"":pct+"%"}</span></div>
 </article>;
}
export default function OrganizationUsagePanel({organizationId}:{organizationId:string}){
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [days,setDays]=useState(30);
 const [data,setData]=useState<UsagePayload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  if(!db)return;
  setLoading(true);setError("");
  const {data,error}=await db.rpc("bmg_get_organization_usage",{p_organization_id:organizationId,p_days:days});
  if(error){setError(error.message);setData(null)}else setData(data as unknown as UsagePayload);
  setLoading(false);
 },[db,organizationId,days]);
 useEffect(()=>{void load()},[load]);
 return <section dir="rtl" style={{display:"grid",gap:16,marginTop:14}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><h3 style={{margin:"0 0 5px"}}>استهلاك المؤسسة</h3><p style={muted}>الحصة موزعة من إجمالي حساب مالك المساحة، وتشترك فيها جميع مشاريع المؤسسة.</p></div>
   <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
    <select aria-label="فترة سجل الاستهلاك" value={days} onChange={e=>setDays(Number(e.target.value))} style={{padding:"9px 11px",borderRadius:8,background:"var(--input,#17171d)",color:"inherit",border:"1px solid var(--border,#333)"}}><option value={1}>24 ساعة</option><option value={7}>7 أيام</option><option value={30}>30 يومًا</option><option value={90}>90 يومًا</option></select>
    <button type="button" onClick={()=>void load()} disabled={loading} style={{padding:"9px 12px",borderRadius:8,border:"1px solid var(--border,#444)",background:"transparent",color:"inherit"}}>تحديث</button>
   </div>
  </header>
  <p style={muted}>عدد الطلبات الفعلية يظهر منفصلًا. المتبقي من الحصة محسوب بوحدات الاستهلاك الموزون، لأن وزن الطلب يختلف حسب الخدمة. يبدأ اليوم والشهر وفق توقيت UTC.</p>
  {error&&<div role="alert" style={{padding:12,borderRadius:9,background:"rgba(220,50,50,.12)"}}>تعذر تحميل الاستهلاك: {error}</div>}
  {loading&&!data?<p role="status">جارٍ تحميل بيانات الاستهلاك…</p>:data&&<>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
    <article style={cardStyle}><small style={muted}>عدد المساحات الداخلة في التوزيع</small><strong style={{fontSize:24}}>{number(data.allocation.scopeCount)}</strong><small style={muted}>ترتيب هذه المساحة: {number(data.allocation.scopePosition)}</small></article>
    <article style={cardStyle}><small style={muted}>طلبات آخر دقيقة</small><strong style={{fontSize:24}}>{number(data.usage.requestsPerMinute)}</strong><small style={muted}>الحد المخصص: {number(data.allocation.requestsPerMinute)}</small></article>
    <article style={cardStyle}><small style={muted}>طلبات اليوم الفعلية</small><strong style={{fontSize:24}}>{number(data.usage.dailyRequests)}</strong><small style={muted}>الاستهلاك الموزون: {number(data.usage.dailyWeightedUsage)}</small></article>
    <article style={cardStyle}><small style={muted}>طلبات الشهر الفعلية</small><strong style={{fontSize:24}}>{number(data.usage.monthlyRequests)}</strong><small style={muted}>الاستهلاك الموزون: {number(data.usage.monthlyWeightedUsage)}</small></article>
    <article style={cardStyle}><small style={muted}>الطلبات الفعلية · آخر {days} يوم</small><strong style={{fontSize:24}}>{number(data.projects.reduce((sum,x)=>sum+x.requests,0))}</strong><small style={muted}>مجمعة من كل مشاريع المؤسسة</small></article>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10}}>
    <UsageMeter label="المتبقي من الحصة اليومية الموزونة" value={data.usage.dailyWeightedUsage} limit={data.allocation.dailyWeightedLimit} remaining={data.usage.dailyRemaining} percentage={data.usage.dailyPercentage}/>
    <UsageMeter label="المتبقي من الحصة الشهرية الموزونة" value={data.usage.monthlyWeightedUsage} limit={data.allocation.monthlyWeightedLimit} remaining={data.usage.monthlyRemaining} percentage={data.usage.monthlyPercentage}/>
   </div>
   {!data.allocation.dailyWeightedLimit&&!data.allocation.monthlyWeightedLimit&&!data.allocation.requestsPerMinute&&<p style={{...muted,padding:12,border:"1px dashed var(--border,#444)",borderRadius:9}}>لم تحدد الإدارة حصة مشتركة للمساحات الإضافية بعد. ستظهر الحدود هنا تلقائيًا بعد ضبطها.</p>}
   <section style={cardStyle}><h4 style={{margin:0}}>استهلاك المشاريع</h4><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr><th style={th}>المشروع</th><th style={th}>الطلبات</th><th style={th}>الاستهلاك الموزون</th></tr></thead><tbody>{data.projects.map(x=><tr key={x.id||x.name}><td style={td}>{x.name}</td><td style={td}>{number(x.requests)}</td><td style={td}>{number(x.weightedUsage)}</td></tr>)}{!data.projects.length&&<tr><td style={td} colSpan={3}>لا يوجد استهلاك مسجل خلال الفترة.</td></tr>}</tbody></table></div></section>
   <section style={cardStyle}><h4 style={{margin:0}}>استهلاك الخدمات</h4><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr><th style={th}>الخدمة</th><th style={th}>الطلبات</th><th style={th}>الاستهلاك الموزون</th></tr></thead><tbody>{data.services.map(x=><tr key={x.slug}><td style={td}>{x.slug}</td><td style={td}>{number(x.requests)}</td><td style={td}>{number(x.weightedUsage)}</td></tr>)}{!data.services.length&&<tr><td style={td} colSpan={3}>لا يوجد استهلاك مسجل خلال الفترة.</td></tr>}</tbody></table></div></section>
   <section style={cardStyle}><h4 style={{margin:0}}>آخر الطلبات المسجلة</h4><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr><th style={th}>الخدمة</th><th style={th}>المشروع</th><th style={th}>الحالة</th><th style={th}>الوقت</th></tr></thead><tbody>{data.recent.map(x=><tr key={x.id}><td style={td}>{x.service}</td><td style={td}>{data.projects.find(p=>p.id===x.projectId)?.name||"—"}</td><td style={td}>{x.status??"—"}</td><td style={td}>{new Date(x.createdAt).toLocaleString("ar-EG")}</td></tr>)}{!data.recent.length&&<tr><td style={td} colSpan={4}>لا توجد طلبات حديثة.</td></tr>}</tbody></table></div></section>
  </>}
 </section>;
}
