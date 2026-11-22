"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./admin-reports.module.css";

type Template = {
  id: string; name: string; description: string; frequency: string; period_days: number;
  timezone: string; schedule_hour: number; schedule_minute: number; schedule_weekday: number;
  schedule_monthday: number; sections: string[]; filters: Json; recipient_ids: string[];
  enabled: boolean; next_run_at: string | null; last_run_at: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};
type ReportRun = {
  id: string; template_id: string | null; template_name: string; trigger_type: string; status: string;
  period_start: string; period_end: string; period_days: number; timezone: string; sections: string[];
  filters: Json; recipient_ids: string[]; report_data: Json | null; executive_summary: string | null;
  data_quality: Json; attempts: number; max_attempts: number; last_error: string | null;
  email_status: string; email_error: string | null; created_by: string | null; created_at: string;
  started_at: string | null; completed_at: string | null;
};
type AdminProfile = { id: string; email: string | null; display_name: string | null; role: string };
type FormState = {
  id: string; name: string; description: string; frequency: string; periodDays: number; timezone: string;
  time: string; weekday: number; monthday: number; sections: string[]; service: string;
  userId: string; category: string; statusCode: string; recipients: string[]; enabled: boolean;
};
const SECTION_OPTIONS = [
  ["overview","الملخص التنفيذي"],["usage","الاستخدام"],["performance","الأداء"],
  ["errors","الأخطاء"],["services","الخدمات"],["users","المستخدمون"],
  ["peak_hours","أوقات الذروة"],["status_codes","رموز HTTP"]
] as const;
const EMPTY_FORM: FormState = {
  id:"",name:"",description:"",frequency:"manual",periodDays:7,timezone:"UTC",
  time:"09:00",weekday:1,monthday:1,
  sections:SECTION_OPTIONS.map(x=>x[0]),service:"",userId:"",category:"",statusCode:"",
  recipients:[],enabled:true
};
const date = (value: string | null) => value ? new Date(value).toLocaleString("ar-EG") : "—";
const statusLabel = (value: string) => ({
  queued:"في قائمة الانتظار",running:"قيد الإنشاء",succeeded:"مكتمل",partial:"مكتمل جزئيًا",failed:"فشل",
  manual:"يدوي",scheduled:"مجدول",daily:"يومي",weekly:"أسبوعي",monthly:"شهري"
}[value] || value);
const objectValue = (value: Json | null): Record<string, Json> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json> : {};

export default function AdminReports() {
  const [supabase] = useState(() => { try { return getSupabaseBrowserClient(); } catch { return null; } });
  const [userId,setUserId] = useState("");
  const [templates,setTemplates] = useState<Template[]>([]);
  const [runs,setRuns] = useState<ReportRun[]>([]);
  const [profiles,setProfiles] = useState<AdminProfile[]>([]);
  const [form,setForm] = useState<FormState>(EMPTY_FORM);
  const [selected,setSelected] = useState<ReportRun|null>(null);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("إعدادات قاعدة البيانات غير مكتملة."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [{data:authData,error:authError},{data:templateData,error:templateError},{data:runData,error:runError},{data:profileData,error:profileError}] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("report_templates").select("*").order("created_at",{ascending:false}),
        supabase.from("report_runs").select("*").order("created_at",{ascending:false}).limit(40),
        supabase.from("profiles").select("id,email,display_name,role").in("role",["admin","owner"]).order("created_at",{ascending:true})
      ]);
      if (authError) throw authError;
      if (templateError) throw templateError;
      if (runError) throw runError;
      if (profileError) throw profileError;
      if (!authData.user) throw new Error("انتهت جلسة الدخول.");
      setUserId(authData.user.id);
      setTemplates((templateData||[]) as Template[]);
      setRuns((runData||[]) as ReportRun[]);
      setProfiles((profileData||[]) as AdminProfile[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل التقارير.");
    } finally { setLoading(false); }
  },[supabase]);

  useEffect(()=>{ void load(); },[load]);

  const selectedTemplate = useMemo(()=>templates.find(x=>x.id===form.id)||null,[templates,form.id]);
  const patch = (value: Partial<FormState>) => setForm(current=>({...current,...value}));

  const editTemplate = (template: Template) => {
    const filters=objectValue(template.filters);
    const hour=String(template.schedule_hour).padStart(2,"0");
    const minute=String(template.schedule_minute).padStart(2,"0");
    patch({
      id:template.id,name:template.name,description:template.description,frequency:template.frequency,
      periodDays:template.period_days,timezone:template.timezone,time:hour+":"+minute,
      weekday:template.schedule_weekday,monthday:template.schedule_monthday,
      sections:template.sections,service:String(filters.service||""),userId:String(filters.user_id||""),
      category:String(filters.category||""),statusCode:String(filters.status_code||""),
      recipients:template.recipient_ids,enabled:template.enabled
    });
    setNotice("تم تحميل القالب للتعديل.");
  };

  const saveTemplate = async () => {
    if (!supabase) return;
    if (form.name.trim().length<2) { setError("اسم القالب يجب ألا يقل عن حرفين."); return; }
    if (!form.sections.length) { setError("اختر قسمًا واحدًا على الأقل."); return; }
    setBusy(true);setError("");setNotice("");
    const [hour,minute]=form.time.split(":").map(Number);
    const filters: Record<string,Json> = {};
    if(form.service) filters.service=form.service;
    if(form.userId) filters.user_id=form.userId;
    if(form.category) filters.category=form.category;
    if(form.statusCode) filters.status_code=Number(form.statusCode);
    const payload = {
      name:form.name.trim(),description:form.description.trim(),frequency:form.frequency,
      period_days:form.periodDays,timezone:form.timezone,schedule_hour:hour,schedule_minute:minute,
      schedule_weekday:form.weekday,schedule_monthday:form.monthday,sections:form.sections,
      filters:filters as Json,recipient_ids:form.recipients,enabled:form.enabled,
      ...(!form.id?{created_by:userId}:{})
    };
    try {
      const result=form.id
        ? await supabase.from("report_templates").update(payload).eq("id",form.id)
        : await supabase.from("report_templates").insert(payload);
      if(result.error) throw result.error;
      setForm(EMPTY_FORM);setNotice("تم حفظ قالب التقرير.");await load();
    } catch(e) { setError(e instanceof Error?e.message:"تعذر حفظ القالب."); }
    finally { setBusy(false); }
  };

  const runReport = async (template: Template) => {
    if(!supabase)return;
    setBusy(true);setError("");setNotice("");
    try {
      const {data,error}=await supabase.rpc("bmg_admin_queue_report",{p_template_id:template.id,p_period_days:template.period_days});
      if(error)throw error;
      setNotice("تم وضع التقرير في قائمة الإنشاء. سيظهر هنا بعد معالجة المهمة.");
      await load();
      if(data) setSelected(runs.find(x=>x.id===data)||null);
    } catch(e) { setError(e instanceof Error?e.message:"تعذر طلب إنشاء التقرير."); }
    finally { setBusy(false); }
  };

  const deleteTemplate = async (template: Template) => {
    if(!supabase || !window.confirm("حذف القالب؟ التقارير التي أُنشئت منه ستبقى محفوظة."))return;
    setBusy(true);setError("");
    const {error}=await supabase.from("report_templates").delete().eq("id",template.id);
    if(error)setError(error.message);else{setNotice("تم حذف القالب.");if(form.id===template.id)setForm(EMPTY_FORM);await load();}
    setBusy(false);
  };

  const deleteRun = async (run: ReportRun) => {
    if(!supabase || !window.confirm("حذف نسخة التقرير وسجل محاولاتها؟"))return;
    setBusy(true);setError("");
    const {error}=await supabase.from("report_runs").delete().eq("id",run.id);
    if(error)setError(error.message);else{setNotice("تم حذف التقرير.");if(selected?.id===run.id)setSelected(null);await load();}
    setBusy(false);
  };

  const exportRun = (run: ReportRun,format:"json"|"csv") => {
    if(!run.report_data)return;
    const data=objectValue(run.report_data);
    const filename="nox-report-"+run.id.slice(0,8);
    let content="";
    if(format==="json") content=JSON.stringify({
      platform:"NOX APIS",name:run.template_name,period:{start:run.period_start,end:run.period_end,timezone:run.timezone},
      summary:run.executive_summary,sections:run.sections,data:run.report_data,dataQuality:run.data_quality
    },null,2);
    else {
      const rows:Record<string,unknown>[]=[];
      const overview=objectValue(data.overview||null);
      for(const [key,value] of Object.entries(overview))rows.push({section:"overview",metric:key,value});
      for(const key of ["services","users","statusCodes","peakHours"]){
        const values=data[key];
        if(Array.isArray(values)) for(const item of values) if(item&&typeof item==="object"&&!Array.isArray(item))
          rows.push({section:key,...item as Record<string,unknown>});
      }
      const keys=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
      const cell=(value:unknown)=>'"'+String(value===null||value===undefined?"":typeof value==="object"?JSON.stringify(value):value).replace(/"/g,'""')+'"';
      content=[keys.map(cell).join(","),...rows.map(row=>keys.map(key=>cell(row[key])).join(","))].join("\n");
    }
    const blob=new Blob([content],{type:format==="json"?"application/json;charset=utf-8":"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);const anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename+"."+format;anchor.click();URL.revokeObjectURL(url);
  };

  const toggleSection=(section:string,checked:boolean)=>patch({sections:checked?[...form.sections,section]:form.sections.filter(x=>x!==section)});
  const toggleRecipient=(id:string,checked:boolean)=>patch({recipients:checked?[...form.recipients,id]:form.recipients.filter(x=>x!==id)});

  return <div className={styles.root}>
    <div className={styles.heading}>
      <div><span>REPORT AUTOMATION</span><h2>التقارير المجدولة</h2><p>إنشاء التقارير وحفظها وإعادة استخدامها وإرسال إشعاراتها داخل لوحة الإدارة.</p></div>
      <button type="button" onClick={()=>void load()} disabled={loading||busy}>تحديث</button>
    </div>
    {error&&<div className={styles.error}>{error}</div>}
    {notice&&<div className={styles.notice}>{notice}</div>}
    <div className={styles.info}>التقارير تُحفظ دون حذف تلقائي. إعادة المحاولة تلقائية حتى 3 مرات. البريد الإلكتروني غير مفعّل حاليًا لعدم ربط مزوّد إرسال؛ إشعارات لوحة الإدارة تعمل للمستلمين المحددين.</div>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h3>{form.id?"تعديل قالب":"إنشاء قالب تقرير"}</h3>{form.id&&<button type="button" onClick={()=>setForm(EMPTY_FORM)}>قالب جديد</button>}</div>
      <div className={styles.grid}>
        <label>اسم القالب<input value={form.name} onChange={e=>patch({name:e.target.value})} placeholder="مثال: تقرير الاستخدام الأسبوعي"/></label>
        <label>وصف القالب<input value={form.description} onChange={e=>patch({description:e.target.value})} placeholder="وصف اختياري"/></label>
        <label>نوع الجدولة<select value={form.frequency} onChange={e=>patch({frequency:e.target.value})}><option value="manual">يدوي فقط</option><option value="daily">يومي</option><option value="weekly">أسبوعي</option><option value="monthly">شهري</option></select></label>
        <label>الفترة التي يغطيها التقرير<select value={form.periodDays} onChange={e=>patch({periodDays:Number(e.target.value)})}><option value={1}>24 ساعة</option><option value={7}>7 أيام</option><option value={30}>30 يومًا</option><option value={90}>90 يومًا</option></select></label>
        {form.frequency!=="manual"&&<>
          <label>المنطقة الزمنية<select value={form.timezone} onChange={e=>patch({timezone:e.target.value})}><option value="UTC">UTC</option><option value="Africa/Cairo">Africa/Cairo</option><option value="Asia/Riyadh">Asia/Riyadh</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></label>
          <label>وقت التنفيذ<input type="time" value={form.time} onChange={e=>patch({time:e.target.value})}/></label>
          {form.frequency==="weekly"&&<label>يوم التنفيذ<select value={form.weekday} onChange={e=>patch({weekday:Number(e.target.value)})}><option value={1}>الاثنين</option><option value={2}>الثلاثاء</option><option value={3}>الأربعاء</option><option value={4}>الخميس</option><option value={5}>الجمعة</option><option value={6}>السبت</option><option value={7}>الأحد</option></select></label>}
          {form.frequency==="monthly"&&<label>يوم الشهر<input type="number" min="1" max="28" value={form.monthday} onChange={e=>patch({monthday:Math.max(1,Math.min(28,Number(e.target.value)))})}/><small>من 1 إلى 28 لضمان وجود موعد في كل شهر.</small></label>}
        </>}
        <label>الخدمة<select value={form.service} onChange={e=>patch({service:e.target.value})}><option value="">كل الخدمات</option>{/* loaded services are represented by the filter value; options below come from live catalog */}</select></label>
        <label>المستخدم<select value={form.userId} onChange={e=>patch({userId:e.target.value})}><option value="">كل المستخدمين</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name||p.email||p.id}</option>)}</select></label>
        <label>المجال<input value={form.category} onChange={e=>patch({category:e.target.value})} placeholder="مثال: AI"/></label>
        <label>HTTP Status<select value={form.statusCode} onChange={e=>patch({statusCode:e.target.value})}><option value="">كل الحالات</option>{[200,201,400,401,403,404,408,429,500,502,503,504].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      </div>
      <div className={styles.group}><b>الأقسام والإحصائيات</b><div className={styles.checkGrid}>{SECTION_OPTIONS.map(([id,label])=><label key={id}><input type="checkbox" checked={form.sections.includes(id)} onChange={e=>toggleSection(id,e.target.checked)}/>{label}</label>)}</div></div>
      <div className={styles.group}><b>مستلمو التقرير داخل لوحة الإدارة</b><div className={styles.checkGrid}>{profiles.map(p=><label key={p.id}><input type="checkbox" checked={form.recipients.includes(p.id)} onChange={e=>toggleRecipient(p.id,e.target.checked)}/>{p.display_name||p.email||p.id} <small>({p.role})</small></label>)}{!profiles.length&&<small>لا توجد حسابات إدارية محمّلة.</small>}</div></div>
      <label className={styles.enabled}><input type="checkbox" checked={form.enabled} onChange={e=>patch({enabled:e.target.checked})}/> تفعيل القالب والجدولة</label>
      {selectedTemplate&&<p className={styles.hint}>الموعد التالي: {date(selectedTemplate.next_run_at)} · آخر تشغيل: {date(selectedTemplate.last_run_at)}</p>}
      <div className={styles.actions}><button className={styles.primary} type="button" disabled={busy||loading} onClick={()=>void saveTemplate()}>{form.id?"حفظ التعديلات":"حفظ القالب"}</button><button type="button" disabled={busy||loading} onClick={()=>setForm(EMPTY_FORM)}>إعادة ضبط</button></div>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h3>قوالب التقارير</h3><span>{templates.length} قالب</span></div>
      {loading?<p className={styles.empty}>جارٍ تحميل القوالب…</p>:templates.map(template=><article className={styles.template} key={template.id}>
        <div><b>{template.name}</b><p>{template.description||"بدون وصف"} · {statusLabel(template.frequency)} · {template.period_days===1?"24 ساعة":template.period_days+" يوم"}</p>
          <small>{template.frequency!=="manual"?"التنفيذ التالي: "+date(template.next_run_at):"تشغيل يدوي"} · {template.enabled?"مفعّل":"متوقف"}</small></div>
        <div className={styles.actions}><button type="button" disabled={busy} onClick={()=>void runReport(template)}>إنشاء الآن</button><button type="button" disabled={busy} onClick={()=>editTemplate(template)}>تعديل</button><button type="button" disabled={busy} onClick={()=>void deleteTemplate(template)}>حذف</button></div>
      </article>)}
      {!loading&&!templates.length&&<p className={styles.empty}>لم يتم إنشاء قوالب بعد.</p>}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h3>التقارير المحفوظة ومحاولات الإنشاء</h3><span>{runs.length} تقرير</span></div>
      {runs.map(run=><article className={styles.run} key={run.id}>
        <button type="button" className={styles.runMain} onClick={()=>setSelected(run)}>
          <b>{run.template_name}</b><span>{statusLabel(run.status)} · {statusLabel(run.trigger_type)} · {run.period_days===1?"24 ساعة":run.period_days+" يوم"}</span><small>{date(run.created_at)} · المحاولات: {run.attempts}/{run.max_attempts}</small>
        </button>
        <div className={styles.actions}><button type="button" onClick={()=>setSelected(run)}>عرض</button><button type="button" disabled={!run.report_data} onClick={()=>exportRun(run,"json")}>JSON</button><button type="button" disabled={!run.report_data} onClick={()=>exportRun(run,"csv")}>CSV</button><button type="button" disabled={!run.report_data} onClick={()=>{setSelected(run);window.setTimeout(()=>window.print(),100)}}>PDF / طباعة</button><button type="button" onClick={()=>void deleteRun(run)}>حذف</button></div>
      </article>)}
      {!runs.length&&<p className={styles.empty}>لا توجد تقارير محفوظة حتى الآن.</p>}
    </section>
    {selected&&<section className={styles.panel} id="report-preview">
      <div className={styles.panelHeading}><h3>معاينة: {selected.template_name}</h3><button type="button" onClick={()=>setSelected(null)}>إغلاق</button></div>
      <p className={styles.summary}>{selected.executive_summary||"التقرير قيد الإنشاء."}</p>
      <p className={styles.hint}>الفترة: {date(selected.period_start)} — {date(selected.period_end)} · المنطقة: {selected.timezone}</p>
      {selected.last_error&&<div className={styles.error}>آخر خطأ: {selected.last_error}</div>}
      {selected.email_status==="not_configured"&&<div className={styles.info}>لم يُرسل بريد إلكتروني: لم يتم إعداد مزوّد بريد. إشعارات المستلمين داخل المنصة منفصلة عن البريد.</div>}
      {selected.report_data&&<pre className={styles.json}>{JSON.stringify(selected.report_data,null,2)}</pre>}
      <div className={styles.actions}><button type="button" disabled={!selected.report_data} onClick={()=>exportRun(selected,"json")}>تنزيل JSON</button><button type="button" disabled={!selected.report_data} onClick={()=>exportRun(selected,"csv")}>تنزيل CSV</button><button type="button" disabled={!selected.report_data} onClick={()=>window.print()}>طباعة / PDF</button></div>
    </section>}
  </div>;
}
