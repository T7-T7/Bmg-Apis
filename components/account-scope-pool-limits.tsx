"use client";

import {useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";

type PoolLimits={requests_per_minute:number|null;daily_weighted_limit:number|null;monthly_weighted_limit:number|null;updated_at:string|null};
type Form={requests_per_minute:string;daily_weighted_limit:string;monthly_weighted_limit:string};
const empty:Form={requests_per_minute:"",daily_weighted_limit:"",monthly_weighted_limit:""};
const field:React.CSSProperties={display:"grid",gap:6,minWidth:0};
const input:React.CSSProperties={width:"100%",padding:"10px 12px",border:"1px solid var(--border,#34343b)",borderRadius:9,background:"var(--input,#17171d)",color:"inherit"};
const toValue=(value:number|null|undefined)=>value==null?"":String(value);
const toNumber=(value:string)=>value.trim()===""?null:Number(value);
function valid(value:string){if(value.trim()==="")return true;const n=Number(value);return Number.isSafeInteger(n)&&n>0}
export default function AccountScopePoolLimits(){
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [form,setForm]=useState<Form>(empty);
 const [updatedAt,setUpdatedAt]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  if(!db)return;
  setBusy(true);setError("");
  const {data,error}=await db.rpc("bmg_admin_get_scope_pool_limits");
  if(error)setError(error.message);
  else{
   const row=((data||[]) as PoolLimits[])[0];
   setForm(row?{requests_per_minute:toValue(row.requests_per_minute),daily_weighted_limit:toValue(row.daily_weighted_limit),monthly_weighted_limit:toValue(row.monthly_weighted_limit)}:empty);
   setUpdatedAt(row?.updated_at||null);
  }
  setBusy(false);
 },[db]);
 useEffect(()=>{void load()},[load]);
 async function save(){
  if(!db)return;
  if(!valid(form.requests_per_minute)||!valid(form.daily_weighted_limit)||!valid(form.monthly_weighted_limit)){
   setError("أدخل أعدادًا صحيحة موجبة أو اترك الحقل فارغًا لتعطيل ذلك الحد.");return;
  }
  setBusy(true);setError("");setNotice("");
  const {error}=await db.rpc("bmg_admin_set_scope_pool_limits",{
   p_requests_per_minute:toNumber(form.requests_per_minute),
   p_daily_weighted_limit:toNumber(form.daily_weighted_limit),
   p_monthly_weighted_limit:toNumber(form.monthly_weighted_limit)
  });
  if(error)setError(error.message);
  else{setNotice("تم حفظ الحصة العامة للمساحات الإضافية.");await load()}
  setBusy(false);
 }
 return <section dir="rtl" style={{display:"grid",gap:14,padding:"4px 0 20px",borderBottom:"1px solid var(--border,#333)",marginBottom:18}}>
  <div><h2 style={{margin:"0 0 6px"}}>الحصة المشتركة للمؤسسات والمساحات الإضافية</h2><p style={{fontSize:13,opacity:.75,margin:0}}>تحدد الإدارة إجمالي الحصة لكل حساب. يوزعها النظام بالتساوي على المؤسسات والشركات والمساحات الشخصية الإضافية التابعة لمالك الحساب. المساحة الشخصية الافتراضية مستثناة. قبل حفظ تخصيص مخصص، يستخدم النظام حدود الخطة كحصة افتراضية مستقلة لهذه المساحات.</p></div>
  {error&&<div role="alert" style={{padding:10,borderRadius:8,background:"rgba(220,50,50,.12)"}}>{error}</div>}
  {notice&&<div role="status" style={{padding:10,borderRadius:8,background:"rgba(40,160,100,.12)"}}>{notice}</div>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
   <label style={field}>الحد الإجمالي لكل حساب · RPM<input style={input} type="number" min="1" step="1" placeholder="غير مفعل" value={form.requests_per_minute} onChange={e=>setForm(v=>({...v,requests_per_minute:e.target.value}))}/></label>
   <label style={field}>الحد الإجمالي اليومي الموزون<input style={input} type="number" min="1" step="1" placeholder="غير مفعل" value={form.daily_weighted_limit} onChange={e=>setForm(v=>({...v,daily_weighted_limit:e.target.value}))}/></label>
   <label style={field}>الحد الإجمالي الشهري الموزون<input style={input} type="number" min="1" step="1" placeholder="غير مفعل" value={form.monthly_weighted_limit} onChange={e=>setForm(v=>({...v,monthly_weighted_limit:e.target.value}))}/></label>
  </div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><button type="button" disabled={busy} onClick={()=>void save()} style={{padding:"10px 14px",border:0,borderRadius:9,background:"var(--accent,#7046d8)",color:"#fff"}}>حفظ الحصة المشتركة</button><button type="button" disabled={busy} onClick={()=>void load()} style={{padding:"10px 14px",border:"1px solid var(--border,#444)",borderRadius:9,background:"transparent",color:"inherit"}}>تحديث</button>{updatedAt&&<small style={{opacity:.7}}>آخر تحديث: {new Date(updatedAt).toLocaleString("ar-EG")}</small>}</div>
  <small style={{opacity:.7}}>التوزيع يستخدم أعدادًا صحيحة؛ إذا تبقى جزء بعد القسمة، يذهب الطلب الزائد إلى المساحات الأقدم أولًا. ترك الحقول فارغة قبل أول حفظ يعني استخدام حدود الخطة الافتراضية؛ أما بعد حفظ إعداد مخصص، فالحقل الفارغ يعطل هذا النوع من الحدود.</small>
 </section>;
}
