"use client";
import {useState} from "react";
import {Copy,LoaderCircle,Play,RotateCcw} from "lucide-react";
import {apiCatalog} from "@/lib/api/catalog";
type Result={status:number;duration:number;body:unknown};
export default function Playground(){
 const live=apiCatalog.filter(x=>x.status==="live");
 const [slug,setSlug]=useState(live[0]?.slug??"ai-chat"),[key,setKey]=useState(""),[prompt,setPrompt]=useState("اشرح مفهوم REST API باختصار"),[instruction,setInstruction]=useState("أجب باللغة العربية بوضوح."),[base,setBase]=useState("USD"),[target,setTarget]=useState("EUR"),[busy,setBusy]=useState(false),[result,setResult]=useState<Result|null>(null),[error,setError]=useState("");
 const api=live.find(x=>x.slug===slug)!;
 async function run(){
  if(!key.trim()){setError("أدخل مفتاح Nox API أولًا.");return}
  setBusy(true);setError("");setResult(null);const started=performance.now();
  try{
   const url=api.slug==="currency-rate"?"/api/v1/currency/rate?base="+encodeURIComponent(base)+"&target="+encodeURIComponent(target):"/api/v1/ai/gemini";
   const response=await fetch(url,{method:api.method,headers:{Authorization:"Bearer "+key.trim(),...(api.method==="POST"?{"Content-Type":"application/json"}:{})},...(api.method==="POST"?{body:JSON.stringify({prompt,instruction})}:{})});
   const body:unknown=await response.json();setResult({status:response.status,duration:Math.round(performance.now()-started),body});
   if(!response.ok){const data=body as {error?:string};setError(data.error??"HTTP "+response.status)}
  }catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال بالخدمة.")}
  finally{setBusy(false)}
 }
 return <div className="source-page"><div className="source-page-head"><span className="source-overline">LIVE REQUEST / 01</span><h1>Playground</h1><p>أرسل طلبًا فعليًا إلى إحدى الخدمات المنشورة. لن يتم توليد استجابة وهمية.</p></div>
 <div className="source-playground"><aside><b>الخدمات</b>{live.map(x=><button key={x.slug} className={slug===x.slug?"selected":""} onClick={()=>{setSlug(x.slug);setResult(null);setError("")}}><span>{x.name}</span><small>{x.method} · {x.path}</small></button>)}</aside>
 <section className="source-playground-editor"><label>مفتاح Nox API<input dir="ltr" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="nox_live_..."/></label>
 {api.slug==="ai-chat"?<><label>Prompt<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5} maxLength={30000}/></label><label>Instruction<input value={instruction} onChange={e=>setInstruction(e.target.value)}/></label></>:<div className="source-currency-fields"><label>من<input dir="ltr" maxLength={3} value={base} onChange={e=>setBase(e.target.value.toUpperCase())}/></label><label>إلى<input dir="ltr" maxLength={3} value={target} onChange={e=>setTarget(e.target.value.toUpperCase())}/></label></div>}
 <div className="source-play-actions"><button className="source-button primary" disabled={busy} onClick={run}>{busy?<LoaderCircle className="spin" size={16}/>:<Play size={15}/>} إرسال الطلب</button><button className="source-button" onClick={()=>{setResult(null);setError("");setPrompt("")}}><RotateCcw size={14}/> مسح</button></div>
 {error&&<div className="source-error">{error}</div>}
 <div className="source-result-head"><b>الاستجابة</b>{result&&<span>{result.status} · {result.duration} ms</span>}{result&&<button onClick={()=>navigator.clipboard.writeText(JSON.stringify(result.body,null,2))}><Copy size={13}/> نسخ</button>}</div>
 <pre dir="ltr"><code>{result?JSON.stringify(result.body,null,2):"// ستظهر استجابة الخادم هنا بعد تنفيذ طلب حقيقي."}</code></pre>
 </section></div></div>;
}