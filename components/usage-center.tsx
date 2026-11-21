"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import styles from "./usage-center.module.css";
type UsageData={periodDays:number;limits:{plan:string;requestsPerMinute:number;maxApiKeys:number;dailyWeightedLimit:number;monthlyWeightedLimit:number;dailyWeightedUsage:number;monthlyWeightedUsage:number;dailyPercentage:number;monthlyPercentage:number;warnings:{period:string;percentage:number;level:string}[]};totals:{requests:number;weightedUsage:number;errors:number;successRate:number|null;avgLatency:number|null;measuredRequests:number};hourly:{hour:string;count:number;weightedUsage:number}[];daily:{date:string;count:number;weightedUsage:number}[];services:{slug:string;count:number;weightedUsage:number}[];recent:{id:number;service:string;method:string;status:number|null;latency:number|null;createdAt:string}[]};
const planName=(v:string)=>({basic:"Basic",pro:"Pro",premium:"Premium",admin:"إدارة"} as Record<string,string>)[v]||v;
export default function UsageCenter(){
 const router=useRouter();const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [days,setDays]=useState(7);const [data,setData]=useState<UsageData|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const load=useCallback(async()=>{if(!db)return;setLoading(true);setError("");const {data,error}=await db.rpc("bmg_get_api_analytics",{p_days:days});if(error)setError(error.message);else setData(data as unknown as UsageData);setLoading(false)},[db,days]);
 useEffect(()=>{let alive=true;if(!db){setLoading(false);setError("إعدادات الاتصال غير مكتملة.");return}db.auth.getUser().then(({data,error})=>{if(!alive)return;if(error||!data.user){router.replace("/login");return}void load()});return()=>{alive=false}},[db,router,load]);
 const exportData=(format:"json"|"csv")=>{if(!data)return;const content=format==="json"?JSON.stringify(data,null,2):["date,requests,weightedUsage",...(days===1?data.hourly.map(x=>[x.hour,x.count,x.weightedUsage].join(",")):data.daily.map(x=>[x.date,x.count,x.weightedUsage].join(",")))].join("\\n");const blob=new Blob([content],{type:format==="json"?"application/json":"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="my-api-usage-"+days+"d."+format;a.click();URL.revokeObjectURL(url)};
 const progress=(value:number,limit:number)=>Math.min(100,Math.max(0,limit?value/limit*100:0));
 return <main className={styles.page} dir="rtl">
  <header className={styles.header}><div><span>ACCOUNT / USAGE</span><h1>الاستهلاك والحدود</h1><p>متابعة الطلبات والاستهلاك الموزون وحدود الحساب.</p></div><button onClick={()=>void load()} disabled={loading}>تحديث</button></header>
  {error&&<div className={styles.error}>{error}</div>}
  {loading&&!data?<div className={styles.empty}>جارٍ تحميل بيانات الاستهلاك…</div>:data&&<>
   <div className={styles.plan}><div><small>المستوى الحالي</small><b>{planName(data.limits.plan)}</b></div><div><small>الطلبات / دقيقة</small><b>{data.limits.requestsPerMinute}</b></div><div><small>الحد الأقصى للمفاتيح</small><b>{data.limits.maxApiKeys}</b></div></div>
   {data.limits.warnings.map((w,i)=><div className={styles.warning} key={i}><b>{w.level==="critical"?"تجاوز حد الاستهلاك":w.level==="warning"?"اقتربت من الحد":"تنبيه استهلاك"}</b><span>{w.period==="daily"?"الاستهلاك اليومي":"الاستهلاك الشهري"} وصل إلى {w.percentage}% من الحد. الطلبات لا تتوقف بسبب هذا التنبيه.</span></div>)}
   <section className={styles.limits}><h2>حدود Weighted Usage</h2><UsageProgress title="الاستهلاك اليومي" value={data.limits.dailyWeightedUsage} limit={data.limits.dailyWeightedLimit} percentage={data.limits.dailyPercentage}/><UsageProgress title="الاستهلاك الشهري" value={data.limits.monthlyWeightedUsage} limit={data.limits.monthlyWeightedLimit} percentage={data.limits.monthlyPercentage}/></section>
   <div className={styles.stats}><article><small>الطلبات الفعلية</small><b>{data.totals.requests.toLocaleString("en-US")}</b></article><article><small>Weighted Usage</small><b>{data.totals.weightedUsage.toLocaleString("en-US")}</b></article><article><small>نسبة النجاح</small><b>{data.totals.successRate===null?"—":data.totals.successRate+"%"}</b></article><article><small>متوسط الاستجابة</small><b>{data.totals.avgLatency===null?"—":data.totals.avgLatency+" ms"}</b></article></div>
   <section className={styles.section}><div className={styles.sectionHead}><h2>سجل الاستهلاك</h2><div className={styles.controls}>{[1,7,30,90].map(n=><button key={n} className={days===n?styles.selected:""} onClick={()=>setDays(n)}>{n===1?"24 ساعة":n+" يوم"}</button>)}<button onClick={()=>exportData("csv")}>CSV</button><button onClick={()=>exportData("json")}>JSON</button></div></div>
    {(days===1?data.hourly.map(x=>({label:x.hour.slice(11,16),count:x.count,weighted:x.weightedUsage})):data.daily.map(x=>({label:x.date,count:x.count,weighted:x.weightedUsage}))).map((x,i,arr)=><div className={styles.bar} key={i}><span>{x.label}</span><div><i style={{width:Math.max(1,x.weighted/Math.max(1,...arr.map(v=>v.weighted))*100)+"%"}}/></div><b>{x.count}</b></div>)}
   </section>
   <div className={styles.two}><section className={styles.section}><h2>استهلاك الخدمات</h2>{data.services.map(x=><div className={styles.service} key={x.slug}><b>{x.slug}</b><span>{x.count} طلب · {x.weightedUsage} وزن</span></div>)}</section><section className={styles.section}><h2>آخر الطلبات</h2>{data.recent.map(x=><div className={styles.service} key={x.id}><b>{x.service} · {x.status??"—"}</b><span>{x.latency===null?"—":x.latency+" ms"} · {new Date(x.createdAt).toLocaleString("ar-EG")}</span></div>)}</section></div>
  </>}
 </main>;
}
function UsageProgress({title,value,limit,percentage}:{title:string;value:number;limit:number;percentage:number|null}){
 const pct=percentage??0;const color=pct>=100?styles.red:pct>=95?styles.orange:pct>=80?styles.yellow:styles.green;
 return <div className={styles.progress}><div><b>{title}</b><span>{value.toLocaleString("en-US")} / {limit.toLocaleString("en-US")} <small>{pct}%</small></span></div><div className={styles.track}><i className={color} style={{width:Math.min(100,Math.max(0,pct))+"%"}}/></div></div>;
}
