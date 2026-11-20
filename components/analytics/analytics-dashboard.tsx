"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpLeft, Clock3, Gauge, RefreshCw, Signal, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AnalyticsData = {
  totals: { requests: number; successRate: number | null; avgLatency: number | null; measuredRequests: number };
  daily: { date: string; count: number }[];
  services: { slug: string; count: number }[];
  recent: { id: number; service: string; method: string; status: number | null; latency: number | null; createdAt: string }[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function UsageChart({ data }: { data: AnalyticsData["daily"] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 720;
    const y = 150 - (item.count / max) * 126;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,150 ${line} 720,150`;
  return <div className="market-chart-wrap">
    <div className="market-chart-grid"><span>{max}</span><span>{Math.ceil(max * .66)}</span><span>{Math.ceil(max * .33)}</span><span>0</span></div>
    <svg className="market-chart" viewBox="0 0 720 160" role="img" aria-label="حركة طلبات API خلال آخر 30 يومًا" preserveAspectRatio="none">
      <defs><linearGradient id="usage-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#aab4c0" stopOpacity=".22"/><stop offset="100%" stopColor="#aab4c0" stopOpacity="0"/></linearGradient></defs>
      {[24,66,108,150].map(y => <line key={y} x1="0" x2="720" y1={y} y2={y} className="market-grid-line"/>)}
      <polygon points={area} fill="url(#usage-fill)"/>
      <polyline points={line} fill="none" className="market-chart-line"/>
      {points.filter((_, i) => i === points.length - 1).map(point => <circle key={point.date} cx={point.x} cy={point.y} r="4" className="market-chart-point"/>)}
    </svg>
    <div className="market-chart-dates"><span>منذ 30 يومًا</span><span>اليوم</span></div>
  </div>;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const { data: sessionData, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("سجّل الدخول لعرض تحليلات حسابك.");
      const { data, error: analyticsError } = await getSupabaseBrowserClient().rpc("bmg_get_api_analytics", { p_days: 30 });
      if (analyticsError) throw analyticsError;
      if (!data) throw new Error("لا توجد استجابة من خدمة التحليلات.");
      setData(data as AnalyticsData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ غير متوقع.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const maxService = useMemo(() => Math.max(1, ...(data?.services.map((item) => item.count) ?? [])), [data]);
  const hasData = Boolean(data && data.totals.requests > 0);

  return <div className="market-page">
    <div className="market-heading">
      <div><span className="market-kicker"><Activity size={14}/> DEVELOPER MARKET / ANALYTICS</span><h1>مركز التحليلات</h1><p>راقب أداء واجهاتك وحركة الطلبات كما تتابع لوحة أسواق مالية — لكن بمؤشرات تشغيل فعلية من حسابك.</p></div>
      <button className="market-refresh" onClick={() => void load()} disabled={busy}><RefreshCw size={15} className={busy ? "market-spin" : ""}/> تحديث البيانات</button>
    </div>
    <div className="market-range"><span><i/> بيانات آخر 30 يومًا</span><span>مصدر البيانات: سجل API Usage</span></div>
    {error && <div className="market-message"><Signal size={17}/><span>{error} تأكد من إعداد SUPABASE_SERVICE_ROLE_KEY على Vercel.</span></div>}
    <div className="market-metrics">
      <article><span className="market-metric-icon"><Activity size={17}/></span><small>إجمالي الطلبات</small><strong>{busy ? "—" : formatNumber(data?.totals.requests ?? 0)}</strong><em>طلب مسجل</em></article>
      <article><span className="market-metric-icon"><Gauge size={17}/></span><small>معدل النجاح</small><strong>{busy || data?.totals.successRate === null ? "—" : `${data?.totals.successRate}%`}</strong><em>من الطلبات ذات حالة HTTP</em></article>
      <article><span className="market-metric-icon"><Clock3 size={17}/></span><small>متوسط زمن الاستجابة</small><strong>{busy || data?.totals.avgLatency === null ? "—" : `${data?.totals.avgLatency} ms`}</strong><em>للطلبات المقاسة فقط</em></article>
      <article><span className="market-metric-icon"><Zap size={17}/></span><small>الخدمات المستخدمة</small><strong>{busy ? "—" : data?.services.length ?? 0}</strong><em>خدمات لها سجل استخدام</em></article>
    </div>
    <div className="market-main-grid">
      <section className="market-panel market-volume">
        <div className="market-panel-head"><div><span>ACTIVITY OVERVIEW</span><h2>حركة الطلبات</h2></div><b>30D</b></div>
        {busy ? <div className="market-chart-empty">جارٍ تحميل بيانات الاستخدام...</div> : hasData ? <UsageChart data={data!.daily}/> : <div className="market-chart-empty"><Activity size={24}/><b>لا توجد حركة مسجلة بعد</b><span>بعد استدعاء إحدى واجهات API بمفتاح حسابك ستظهر الحركة هنا.</span></div>}
      </section>
      <section className="market-panel">
        <div className="market-panel-head"><div><span>SERVICE DISTRIBUTION</span><h2>توزيع الاستخدام</h2></div><ArrowUpLeft size={16}/></div>
        {busy ? <div className="market-chart-empty">جارٍ التحميل...</div> : data?.services.length ? <div className="market-services">{data.services.map((item) => <div className="market-service-row" key={item.slug}><div><b>{item.slug}</b><small>{formatNumber(item.count)} طلب</small></div><div className="market-bar"><i style={{width: `${(item.count / maxService) * 100}%`}}/></div></div>)}</div> : <div className="market-chart-empty">لا توجد بيانات كافية للعرض.</div>}
      </section>
    </div>
    <section className="market-panel market-recent">
      <div className="market-panel-head"><div><span>LIVE TAPE / RECENT REQUESTS</span><h2>آخر النشاطات</h2></div><span className="market-table-note">حتى 12 طلبًا حديثًا</span></div>
      {busy ? <div className="market-chart-empty">جارٍ تحميل السجل...</div> : data?.recent.length ? <div className="market-table-wrap"><table><thead><tr><th>الخدمة</th><th>الطريقة</th><th>الحالة</th><th>الزمن</th><th>التوقيت</th></tr></thead><tbody>{data.recent.map((item) => <tr key={item.id}><td dir="ltr">{item.service}</td><td><code>{item.method}</code></td><td><span className={item.status && item.status < 400 ? "market-status ok" : item.status ? "market-status bad" : "market-status pending"}>{item.status ?? "غير مسجل"}</span></td><td>{item.latency === null ? "—" : `${item.latency} ms`}</td><td>{new Date(item.createdAt).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"})}</td></tr>)}</tbody></table></div> : <div className="market-chart-empty">لا يوجد سجل طلبات بعد. عند تسجيل أول طلب سيظهر هنا.</div>}
    </section>
    <p className="market-disclaimer"><ArrowDownLeft size={14}/> هذه لوحة مراقبة لا لوحة تداول مالي. لا تعرض أسعار أسهم أو أرباحًا افتراضية؛ كل المؤشرات المعروضة مأخوذة من سجلات استخدام API الفعلية.</p>
  </div>;
}
