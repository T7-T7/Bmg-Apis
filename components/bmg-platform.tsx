"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

type View = "home" | "explorer" | "playground" | "docs" | "dashboard" | "keys" | "status";
type Service = { id?: string; slug: string; name: string; description: string; category: string; endpoint_path: string; http_method: string; status: string };
type ApiKey = { id: string; label: string; key_prefix: string; created_at: string; last_used_at: string | null; expires_at: string | null; revoked_at: string | null };
type Analytics = { totals?: { requests?: number; successRate?: number | null; avgLatency?: number | null }; daily?: { date: string; count: number }[]; recent?: { id: number; service: string; method: string; status: number | null; latency: number | null; createdAt: string }[] };
const LIVE_SERVICES: Service[] = [
  { slug: "aql-gemini", name: "عقل — Gemini", description: "واجهة محادثة نصية تعتمد على محرك Gemini مع دعم التعليمات والجلسات.", category: "ذكاء اصطناعي", endpoint_path: "/api/v1/ai/gemini", http_method: "POST", status: "active" },
  { slug: "currency-rate", name: "أسعار العملات", description: "الحصول على سعر صرف مرجعي بين عملتين عبر Frankfurter.", category: "بيانات مالية", endpoint_path: "/api/v1/currency/rate", http_method: "GET", status: "active" },
];
const PLANNED_SERVICES: Service[] = [
  { slug: "whatsapp-send", name: "WhatsApp Send", description: "إرسال الرسائل والوسائط عبر جلسات واتساب.", category: "واتساب", endpoint_path: "/v1/whatsapp/send", http_method: "POST", status: "development" },
  { slug: "sticker-maker", name: "Sticker Maker", description: "تحويل الصور إلى ملصقات WebP.", category: "وسائط", endpoint_path: "/v1/media/sticker", http_method: "POST", status: "development" },
  { slug: "media-downloader", name: "Media Downloader", description: "تنزيل الوسائط من الروابط المدعومة.", category: "وسائط", endpoint_path: "/v1/download", http_method: "GET", status: "development" },
];
const NAV: { id: View; label: string; icon: string; group: string }[] = [
  { id: "home", label: "الرئيسية", icon: "⌂", group: "المنصة" },
  { id: "explorer", label: "استكشاف APIs", icon: "◈", group: "المنصة" },
  { id: "playground", label: "مختبر التجربة", icon: "⌘", group: "المنصة" },
  { id: "docs", label: "التوثيق", icon: "▤", group: "المنصة" },
  { id: "dashboard", label: "لوحة التحكم", icon: "▦", group: "حسابي" },
  { id: "keys", label: "مفاتيح API", icon: "⚿", group: "حسابي" },
  { id: "status", label: "حالة الخدمات", icon: "◉", group: "حسابي" },
];

function Icon({ children }: { children: string }) { return <span className="icon" aria-hidden="true">{children}</span>; }
function Badge({ live }: { live: boolean }) { return <span className={`badge ${live ? "badge-live" : "badge-soon"}`}><i />{live ? "متاحة الآن" : "قيد التطوير"}</span>; }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

export default function BmgPlatform() {
  const supabase = useMemo(() => getSupabase(), []);
  const [view, setView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [services, setServices] = useState<Service[]>(LIVE_SERVICES);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [selectedService, setSelectedService] = useState<Service>(LIVE_SERVICES[0]);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("اشرح مفهوم REST API باختصار.");
  const [instruction, setInstruction] = useState("أجب باللغة العربية وبأسلوب واضح.");
  const [base, setBase] = useState("USD");
  const [target, setTarget] = useState("EUR");
  const [response, setResponse] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMeta, setRequestMeta] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("مفتاح رئيسي");
  const [createdKey, setCreatedKey] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const allServices = useMemo(() => [...services, ...PLANNED_SERVICES.filter(p => !services.some(s => s.slug === p.slug))], [services]);
  const categories = useMemo(() => ["الكل", ...Array.from(new Set(allServices.map(s => s.category)))], [allServices]);
  const filteredServices = useMemo(() => allServices.filter(s => (category === "الكل" || s.category === category) && (s.name + s.description + s.slug).toLowerCase().includes(search.toLowerCase())), [allServices, category, search]);

  const loadAccountData = useCallback(async () => {
    if (!supabase || !user) return;
    const [keyResult, analyticsResult] = await Promise.all([
      supabase.rpc("bmg_list_api_keys"),
      supabase.rpc("bmg_get_api_analytics", { p_days: 14 }),
    ]);
    if (!keyResult.error && Array.isArray(keyResult.data)) setKeys(keyResult.data as ApiKey[]);
    if (!analyticsResult.error && analyticsResult.data) setAnalytics(analyticsResult.data as Analytics);
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setUser(next?.user ?? null); });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("api_services").select("id,slug,name,description,category,endpoint_path,http_method,status").order("created_at", { ascending: true })
      .then(({ data, error }) => { if (active && !error && data?.length) setServices(data as Service[]); });
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => { if (user) void loadAccountData(); }, [user, loadAccountData]);

  const navigate = (next: View) => { setView(next); setNotice(""); if (next === "keys" || next === "dashboard") void loadAccountData(); };
  const requireAuth = () => { setAuthMode("login"); setAuthMessage(""); setAuthOpen(true); };

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setAuthMessage("إعدادات Supabase العامة غير موجودة في إعدادات النشر."); return; }
    setAuthBusy(true); setAuthMessage("");
    try {
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (result.error) throw result.error;
      setAuthMessage(authMode === "signup" && !result.data.session ? "تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيده." : "تم تسجيل الدخول بنجاح.");
      if (result.data.session) { setAuthOpen(false); setView("dashboard"); }
    } catch (error) { setAuthMessage(error instanceof Error ? error.message : "تعذر إكمال المصادقة."); }
    finally { setAuthBusy(false); }
  }

  async function googleLogin() {
    if (!supabase) { setAuthMessage("إعدادات Supabase العامة غير موجودة في إعدادات النشر."); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) setAuthMessage(error.message);
  }

  async function signOut() { await supabase?.auth.signOut(); setKeys([]); setAnalytics(null); setView("home"); }

  async function createKey() {
    if (!supabase || !user) { requireAuth(); return; }
    setKeyBusy(true); setCreatedKey("");
    try {
      const raw = `nox_live_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
      const { error } = await supabase.rpc("bmg_create_api_key", { p_key: raw, p_label: newKeyLabel.trim() || "مفتاح جديد" });
      if (error) throw error;
      setCreatedKey(raw); setNotice("تم إنشاء المفتاح. لن تظهر قيمته الكاملة مرة أخرى.");
      await loadAccountData();
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر إنشاء المفتاح."); }
    finally { setKeyBusy(false); }
  }

  async function revokeKey(id: string) {
    if (!supabase) return;
    if (!window.confirm("هل تريد إلغاء هذا المفتاح؟ لن يمكن استخدامه بعد ذلك.")) return;
    const { error } = await supabase.rpc("bmg_revoke_api_key", { p_id: id });
    if (error) setNotice(error.message); else { setNotice("تم إلغاء المفتاح."); await loadAccountData(); }
  }

  async function runRequest() {
    setRequestBusy(true); setResponse(""); setRequestMeta("");
    const started = performance.now();
    try {
      let url = selectedService.endpoint_path;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
      const options: RequestInit = { method: selectedService.http_method, headers };
      if (selectedService.slug === "aql-gemini") options.body = JSON.stringify({ prompt, instruction });
      if (selectedService.slug === "currency-rate") url += `?base=${encodeURIComponent(base)}&target=${encodeURIComponent(target)}`;
      const result = await fetch(url, options);
      const data = await result.json().catch(() => ({ error: "استجابة غير صالحة من الخادم." }));
      setResponse(JSON.stringify(data, null, 2));
      setRequestMeta(`HTTP ${result.status} · ${Math.round(performance.now() - started)} ms`);
    } catch (error) {
      setResponse(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "تعذر الاتصال بالخادم." }, null, 2));
      setRequestMeta("فشل الاتصال");
    } finally { setRequestBusy(false); }
  }

  const navButton = (item: typeof NAV[number]) => <button key={item.id} className={`nav-link ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><Icon>{item.icon}</Icon><span>{item.label}</span>{item.id === "explorer" && <small>2</small>}</button>;
  const openPlayground = (service: Service) => { setSelectedService(service); setView("playground"); setResponse(""); };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("home")}><span className="brand-mark">B</span><span><b>BMG<span> APIs</span></b><small>DEVELOPER PLATFORM</small></span></button>
      <div className="workspace"><span className="workspace-dot" /> مساحة المطورين <span className="chevron">⌄</span></div>
      <div className="nav-scroll">
        {["المنصة", "حسابي"].map(group => <div className="nav-group" key={group}><p>{group}</p>{NAV.filter(n => n.group === group).map(navButton)}</div>)}
      </div>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><b>تحتاج مساعدة؟</b><p>راجع التوثيق للبدء بسرعة.</p><button onClick={() => navigate("docs")}>مركز التوثيق <span>←</span></button></div><div className="sidebar-foot"><span className="online-dot" /> جميع الأنظمة تعمل</div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>BMG APIs</span><b>/</b><strong>{NAV.find(n => n.id === view)?.label ?? "الرئيسية"}</strong></div><div className="top-actions"><a className="top-link" href="/api/openapi.json" target="_blank" rel="noreferrer">OpenAPI <span>↗</span></a>{user ? <div className="user-menu"><span className="avatar">{(user.email?.[0] ?? "U").toUpperCase()}</span><span className="user-email">{user.email}</span><button className="text-button" onClick={signOut}>خروج</button></div> : <button className="button button-primary button-small" onClick={requireAuth}>تسجيل الدخول</button>}</div></header>

      {view === "home" && <section className="page-content">
        <div className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> بنية واحدة، إمكانيات متعددة</div><h1>كل ما يحتاجه المطوّر<br /><em>في واجهة API واحدة.</em></h1><p>اكتشف واجهات برمجية عملية، اختبرها مباشرة، وأدر مفاتيح الوصول من مساحة عمل واحدة مصممة للمطورين.</p><div className="hero-actions"><button className="button button-primary" onClick={() => navigate("explorer")}>استكشف الواجهات <span>←</span></button><button className="button button-ghost" onClick={() => navigate("docs")}>اقرأ التوثيق <span>↗</span></button></div><div className="hero-proof"><span><b>02</b> واجهات متاحة</span><i /> <span><b>24/7</b> وصول إلى المنصة</span><i /> <span><b>REST</b> API</span></div></div><div className="hero-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="code-window"><div className="code-head"><div><i /><i /><i /></div><span>REQUEST / RESPONSE</span><b>•••</b></div><div className="code-body"><div className="code-line"><span>01</span><code><b>const</b> response = <i>await</i> fetch(</code></div><div className="code-line indent"><span>02</span><code><mark>&quot;/api/v1/ai/gemini&quot;</mark>, {'{'}</code></div><div className="code-line indent"><span>03</span><code>method: <mark>&quot;POST&quot;</mark>,</code></div><div className="code-line indent"><span>04</span><code>headers: &#123; Authorization &#125;</code></div><div className="code-line"><span>05</span><code>{'}'});</code></div><div className="code-divider" /><div className="response-label"><span className="online-dot" /> 200 OK <small>248 ms</small></div><div className="response-json"><span>{'{'}</span><br /><span className="json-key">&quot;success&quot;</span>: <b>true</b>,<br /><span className="json-key">&quot;response&quot;</span>: <mark>&quot;مرحباً بك في BMG APIs&quot;</mark><br /><span>{'}'}</span></div></div></div><div className="floating-chip chip-top"><span>✦</span><div><b>Developer first</b><small>مصممة للمطورين</small></div></div><div className="floating-chip chip-bottom"><span className="pulse-dot" /><div><b>API Status</b><small>جميع الأنظمة مستقرة</small></div></div></div></div>
        <div className="section-heading"><div><span className="section-kicker">ابدأ من هنا</span><h2>أدواتك الأساسية</h2><p>كل ما تحتاجه لبناء التكاملات وإدارتها.</p></div><button className="inline-link" onClick={() => navigate("explorer")}>عرض كل الخدمات <span>←</span></button></div>
        <div className="feature-grid"><button className="feature-card" onClick={() => navigate("explorer")}><span className="feature-icon purple">◈</span><b>API Explorer</b><p>اكتشف الواجهات المتاحة وتعرّف على تفاصيل كل نقطة اتصال.</p><span className="feature-arrow">←</span></button><button className="feature-card" onClick={() => navigate("playground")}><span className="feature-icon blue">⌘</span><b>Playground</b><p>أرسل طلبات حقيقية وشاهد الاستجابات مباشرة من المتصفح.</p><span className="feature-arrow">←</span></button><button className="feature-card" onClick={() => navigate("keys")}><span className="feature-icon green">⚿</span><b>إدارة المفاتيح</b><p>أنشئ مفاتيح الوصول الخاصة بك وتحكم في صلاحيتها.</p><span className="feature-arrow">←</span></button><button className="feature-card" onClick={() => navigate("docs")}><span className="feature-icon amber">▤</span><b>التوثيق</b><p>أمثلة واضحة ومرجع تقني للبدء في التكامل بسرعة.</p><span className="feature-arrow">←</span></button></div>
        <div className="section-heading service-heading"><div><span className="section-kicker">API CATALOG</span><h2>واجهات متاحة للاستخدام</h2><p>خدمات منشورة يمكنك تجربتها الآن.</p></div><button className="inline-link" onClick={() => navigate("explorer")}>استكشاف الكتالوج <span>←</span></button></div>
        <div className="service-grid">{services.map(service => <ServiceCard key={service.slug} service={service} onOpen={() => openPlayground(service)} onDocs={() => { setSelectedService(service); navigate("docs"); }} />)}</div>
        <div className="bottom-cta"><div><span className="section-kicker">جاهز للانطلاق؟</span><h2>ابدأ بناء تكاملك القادم.</h2><p>أنشئ حسابك واحصل على مفاتيح API الخاصة بك في دقائق.</p></div><button className="button button-primary" onClick={() => user ? navigate("dashboard") : requireAuth()}>{user ? "افتح لوحة التحكم" : "أنشئ حساباً مجانياً"} <span>←</span></button></div>
      </section>}

      {view === "explorer" && <section className="page-content"><PageTitle kicker="API DIRECTORY" title="استكشف واجهات API" desc="تصفح الخدمات المنشورة، اعرف تفاصيل نقاط الاتصال، وابدأ التجربة." /><div className="catalog-toolbar"><div className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن API أو وصف..." /></div><div className="filter-row">{categories.map(c => <button key={c} className={category === c ? "filter-chip selected" : "filter-chip"} onClick={() => setCategory(c)}>{c}</button>)}</div></div><div className="catalog-count">عرض <b>{filteredServices.length}</b> من {allServices.length} واجهات</div><div className="service-grid">{filteredServices.map(service => <ServiceCard key={service.slug} service={service} onOpen={() => service.status === "active" ? openPlayground(service) : setNotice("هذه الخدمة قيد التطوير ولم يتم نشر نقطة الاتصال بعد.")} onDocs={() => { setSelectedService(service); navigate("docs"); }} />)}</div>{notice && <p className="notice">{notice}</p>}</section>}

      {view === "playground" && <section className="page-content"><PageTitle kicker="INTERACTIVE PLAYGROUND" title="مختبر تجربة API" desc="نفّذ طلبات فعلية إلى الخدمات المنشورة وتحقق من الاستجابة." /><div className="playground-layout"><div className="playground-form panel"><div className="panel-head"><div><b>إعداد الطلب</b><small>Request configuration</small></div><span className="live-indicator">● LIVE</span></div><label className="field-label">الخدمة</label><select className="field-control" value={selectedService.slug} onChange={e => setSelectedService(allServices.find(s => s.slug === e.target.value) ?? LIVE_SERVICES[0])}>{allServices.map(s => <option key={s.slug} value={s.slug} disabled={s.status !== "active"}>{s.name}{s.status !== "active" ? " — قريباً" : ""}</option>)}</select><div className="endpoint-line"><span className={selectedService.http_method === "GET" ? "method get" : "method post"}>{selectedService.http_method}</span><code>{selectedService.endpoint_path}</code></div><label className="field-label">مفتاح API <small>اختياري للتجربة العامة، مطلوب للاستخدام بحسابك</small></label><input className="field-control ltr" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="nox_live_••••••••••••••" autoComplete="off" />{selectedService.slug === "aql-gemini" ? <><label className="field-label">Prompt</label><textarea className="field-control code-input" rows={5} value={prompt} onChange={e => setPrompt(e.target.value)} /><label className="field-label">Instruction <small>اختياري</small></label><textarea className="field-control" rows={2} value={instruction} onChange={e => setInstruction(e.target.value)} /></> : selectedService.slug === "currency-rate" ? <div className="currency-fields"><div><label className="field-label">من</label><input className="field-control ltr" maxLength={3} value={base} onChange={e => setBase(e.target.value.toUpperCase())} /></div><div><label className="field-label">إلى</label><input className="field-control ltr" maxLength={3} value={target} onChange={e => setTarget(e.target.value.toUpperCase())} /></div></div> : <div className="empty-state">هذه الخدمة غير متاحة للتجربة حتى يتم نشرها.</div>}<button className="button button-primary run-button" disabled={requestBusy || selectedService.status !== "active"} onClick={runRequest}>{requestBusy ? <><span className="spinner" /> جارٍ تنفيذ الطلب...</> : <>تنفيذ الطلب <span>↗</span></>}</button></div><div className="response-panel panel"><div className="panel-head"><div><b>الاستجابة</b><small>Response preview</small></div>{requestMeta && <span className="response-meta">{requestMeta}</span>}</div><div className="response-toolbar"><span>JSON</span><button onClick={() => { if (response) void navigator.clipboard.writeText(response); }}>نسخ الاستجابة ⧉</button></div><pre className="response-code">{response || <span className="response-placeholder">سيظهر محتوى الاستجابة هنا بعد تنفيذ الطلب.<br /><br />{'{'}<br />  &quot;success&quot;: true,<br />  &quot;data&quot;: ...<br />{'}'}</span>}</pre><div className="response-foot"><span className="online-dot" /> يتم إرسال الطلب إلى خادم BMG APIs مباشرة.</div></div></div></section>}

      {view === "docs" && <section className="page-content"><PageTitle kicker="DOCUMENTATION" title="التوثيق التقني" desc="كل ما تحتاجه لربط تطبيقك بواجهات BMG APIs." /><div className="docs-layout"><nav className="docs-nav"><b>في هذا القسم</b><a href="#quickstart">البداية السريعة</a><a href="#authentication">المصادقة</a><a href="#gemini">Gemini API</a><a href="#currency">Currency API</a><a href="#errors">رموز الاستجابة</a><a href="/api/openapi.json" target="_blank">OpenAPI Specification ↗</a></nav><div className="docs-content"><article id="quickstart" className="doc-card"><span className="section-kicker">01 / GETTING STARTED</span><h2>البداية السريعة</h2><p>يمكنك تجربة الخدمات مباشرة من Playground. للاستخدام من تطبيقك، أنشئ مفتاح API من لوحة التحكم وأرسله في ترويسة Authorization.</p><CodeBlock code={'const response = await fetch("https://YOUR_DOMAIN/api/v1/ai/gemini", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "Authorization": "Bearer nox_live_YOUR_KEY"\n  },\n  body: JSON.stringify({ prompt: "Hello" })\n});\nconst data = await response.json();'} /></article><article id="authentication" className="doc-card"><span className="section-kicker">02 / AUTHENTICATION</span><h2>المصادقة</h2><p>استخدم مفتاحك بصيغة Bearer. لا تضع المفتاح في كود الواجهة الأمامية لتطبيقك أو في المستودعات العامة.</p><CodeBlock code={'Authorization: Bearer nox_live_YOUR_API_KEY'} /></article><article id="gemini" className="doc-card"><span className="section-kicker">03 / AI</span><h2>Gemini — توليد النصوص</h2><div className="endpoint-line"><span className="method post">POST</span><code>/api/v1/ai/gemini</code></div><p>يرسل prompt إلى محرك Gemini. الحد الأقصى للنص 30,000 حرف، وحد الاستخدام 30 طلباً في الدقيقة لكل مفتاح.</p><CodeBlock code={'{\n  "prompt": "اشرح مفهوم REST API",\n  "instruction": "أجب باللغة العربية",\n  "sessionId": "optional-session-id"\n}'} /><p>الاستجابة تتضمن response وsessionId لمتابعة المحادثة.</p></article><article id="currency" className="doc-card"><span className="section-kicker">04 / FINANCE</span><h2>أسعار العملات</h2><div className="endpoint-line"><span className="method get">GET</span><code>/api/v1/currency/rate?base=USD&target=EUR</code></div><p>يعيد سعر صرف مرجعي يومي من Frankfurter. هذه الأسعار ليست أسعار تداول لحظية.</p><CodeBlock code={'{\n  "success": true,\n  "base": "USD",\n  "target": "EUR",\n  "rate": 0.92,\n  "source": "Frankfurter",\n  "rateType": "daily_reference"\n}'} /></article><article id="errors" className="doc-card"><span className="section-kicker">05 / ERRORS</span><h2>رموز الاستجابة</h2><div className="error-table"><div><b>400</b><span>طلب غير صالح أو بيانات ناقصة.</span></div><div><b>401</b><span>مفتاح API غير صالح أو مفقود عند استخدامه.</span></div><div><b>413</b><span>حجم الطلب أو النص تجاوز الحد المسموح.</span></div><div><b>422</b><span>رمز عملة غير مدعوم.</span></div><div><b>429</b><span>تجاوز حد الطلبات.</span></div><div><b>502 / 503</b><span>الخدمة أو المصدر الخارجي غير متاح مؤقتاً.</span></div></div></article></div></div></section>}

      {view === "dashboard" && <section className="page-content"><PageTitle kicker="WORKSPACE OVERVIEW" title="لوحة التحكم" desc="نظرة عامة على نشاط مفاتيحك واستهلاك واجهات API." action={!user ? <button className="button button-primary" onClick={requireAuth}>تسجيل الدخول</button> : undefined} />{!user ? <AuthPrompt onLogin={requireAuth} /> : <><div className="stats-grid"><Stat label="إجمالي الطلبات" value={analytics?.totals?.requests?.toLocaleString("en-US") ?? "0"} icon="↗" /><Stat label="معدل النجاح" value={analytics?.totals?.successRate == null ? "—" : `${analytics.totals.successRate}%`} icon="✓" /><Stat label="متوسط الاستجابة" value={analytics?.totals?.avgLatency == null ? "—" : `${analytics.totals.avgLatency} ms`} icon="◷" /><Stat label="مفاتيح API" value={String(keys.filter(k => !k.revoked_at).length)} icon="⚿" /></div><div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-head"><div><b>نشاط الطلبات</b><small>آخر 14 يوماً · بيانات حسابك</small></div><span className="chart-legend"><i /> الطلبات</span></div><div className="bar-chart">{(analytics?.daily ?? []).map(day => <div className="bar-column" key={day.date} title={`${day.date}: ${day.count}`}><div className="bar-track"><i style={{ height: `${Math.max(3, (day.count / Math.max(1, ...(analytics?.daily ?? []).map(d => d.count))) * 100)}%` }} /></div><small>{new Date(day.date).toLocaleDateString("en-US", { day: "numeric" })}</small></div>)}</div></div><div className="panel quick-panel"><div className="panel-head"><div><b>إجراءات سريعة</b><small>إدارة مساحة العمل</small></div></div><button onClick={() => navigate("keys")}> <span className="quick-icon">⚿</span><span><b>إدارة المفاتيح</b><small>إنشاء أو إلغاء مفتاح</small></span><i>←</i></button><button onClick={() => navigate("playground")}><span className="quick-icon">⌘</span><span><b>تجربة API</b><small>تنفيذ طلب جديد</small></span><i>←</i></button><button onClick={() => navigate("docs")}><span className="quick-icon">▤</span><span><b>التوثيق</b><small>مراجعة دليل الاستخدام</small></span><i>←</i></button></div></div><div className="panel recent-panel"><div className="panel-head"><div><b>أحدث الطلبات</b><small>آخر 12 طلباً مسجلاً لحسابك</small></div><button className="inline-link" onClick={() => navigate("explorer")}>استكشاف الخدمات ←</button></div>{analytics?.recent?.length ? <div className="table-wrap"><table><thead><tr><th>الخدمة</th><th>الطريقة</th><th>الحالة</th><th>الزمن</th><th>التاريخ</th></tr></thead><tbody>{analytics.recent.map(item => <tr key={item.id}><td>{item.service}</td><td><span className={item.method === "GET" ? "method get" : "method post"}>{item.method}</span></td><td><span className="status-code">{item.status ?? "—"}</span></td><td>{item.latency == null ? "—" : `${item.latency} ms`}</td><td>{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div> : <div className="empty-state">لا توجد طلبات مسجلة حتى الآن. جرّب إحدى الواجهات من Playground.</div>}</div></>}</section>}

      {view === "keys" && <section className="page-content"><PageTitle kicker="ACCESS MANAGEMENT" title="مفاتيح API" desc="أنشئ مفاتيح وصول لتطبيقاتك، وراجع آخر استخدام، وألغِ المفاتيح التي لم تعد تحتاجها." />{!user ? <AuthPrompt onLogin={requireAuth} /> : <><div className="panel create-key-panel"><div><span className="feature-icon green">⚿</span><h3>إنشاء مفتاح جديد</h3><p>سيتم عرض قيمة المفتاح مرة واحدة فقط بعد إنشائه.</p></div><div className="create-key-controls"><input className="field-control" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} placeholder="اسم المفتاح" maxLength={64} /><button className="button button-primary" disabled={keyBusy} onClick={createKey}>{keyBusy ? "جارٍ الإنشاء..." : "إنشاء مفتاح +"} </button></div>{createdKey && <div className="created-key"><div><b>احتفظ بمفتاحك الآن</b><small>لن تتمكن من رؤية القيمة الكاملة مرة أخرى.</small></div><code>{createdKey}</code><button onClick={() => void navigator.clipboard.writeText(createdKey)}>نسخ ⧉</button></div>}</div>{notice && <p className="notice">{notice}</p>}<div className="panel keys-panel"><div className="panel-head"><div><b>مفاتيح الوصول</b><small>{keys.length} مفاتيح مسجلة</small></div><button className="inline-link" onClick={() => void loadAccountData()}>تحديث ↻</button></div>{keys.length ? <div className="key-list">{keys.map(key => <div className="key-row" key={key.id}><span className={key.revoked_at ? "key-status revoked" : "key-status"}>{key.revoked_at ? "×" : "✓"}</span><div className="key-info"><b>{key.label}</b><code>{key.key_prefix}••••••••</code></div><div className="key-date"><small>تاريخ الإنشاء</small><span>{formatDate(key.created_at)}</span></div><div className="key-date"><small>آخر استخدام</small><span>{formatDate(key.last_used_at)}</span></div>{!key.revoked_at && <button className="danger-button" onClick={() => void revokeKey(key.id)}>إلغاء المفتاح</button>}</div>)}</div> : <div className="empty-state">لا توجد مفاتيح حتى الآن. أنشئ مفتاحك الأول للبدء.</div>}</div></>}</section>}

      {view === "status" && <section className="page-content"><PageTitle kicker="SYSTEM STATUS" title="حالة الخدمات" desc="معلومات حالة نقاط الاتصال الأساسية في المنصة." /><div className="status-banner"><span className="status-pulse" /><div><b>الخدمات الأساسية متاحة</b><small>الحالة العامة حسب نقاط الاتصال المنشورة.</small></div><span className="status-live">OPERATIONAL</span></div><div className="status-list">{services.map(s => <div className="status-row" key={s.slug}><div><span className="online-dot" /><b>{s.name}</b><small>{s.endpoint_path}</small></div><Badge live={s.status === "active"} /></div>)}</div><div className="panel status-note"><b>ملاحظة حول الحالة</b><p>الحالة المعروضة تعكس حالة تفعيل الخدمة في كتالوج المنصة، وليست قياساً مستمراً لزمن الاستجابة. استخدم Playground لاختبار نقطة الاتصال فعلياً.</p><a href="/api/health" target="_blank">فحص صحة الخادم ↗</a></div></section>}

      <footer className="site-footer"><span>© {new Date().getFullYear()} BMG APIs</span><span>صُنعت للمطورين <i>•</i> <a href="/api/openapi.json" target="_blank">OpenAPI</a></span></footer>
    </main>

    {authOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}><div className="auth-modal"><button className="modal-close" onClick={() => setAuthOpen(false)}>×</button><span className="brand-mark modal-mark">B</span><span className="section-kicker">BMG DEVELOPER ACCOUNT</span><h2>{authMode === "login" ? "مرحباً بعودتك" : "أنشئ حسابك"}</h2><p>{authMode === "login" ? "سجّل الدخول لإدارة مفاتيحك ومتابعة استخدامك." : "أنشئ حساباً للوصول إلى مساحة المطورين."}</p><button className="google-button" onClick={googleLogin}><b>G</b> المتابعة باستخدام Google</button><div className="or-divider"><span>أو باستخدام البريد الإلكتروني</span></div><form onSubmit={submitAuth}><label className="field-label">البريد الإلكتروني</label><input className="field-control ltr" type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@example.com" /><label className="field-label">كلمة المرور</label><input className="field-control ltr" type="password" minLength={6} required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" /><button className="button button-primary auth-submit" disabled={authBusy}>{authBusy ? "جارٍ المعالجة..." : authMode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}</button></form>{authMessage && <p className="auth-message">{authMessage}</p>}<p className="auth-switch">{authMode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"} <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthMessage(""); }}>{authMode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}</button></p></div></div>}
  </div>;
}

function PageTitle({ kicker, title, desc, action }: { kicker: string; title: string; desc: string; action?: React.ReactNode }) { return <div className="page-title"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>; }
function ServiceCard({ service, onOpen, onDocs }: { service: Service; onOpen: () => void; onDocs: () => void }) { const live = service.status === "active"; return <article className="service-card"><div className="service-card-top"><span className="service-symbol">{service.category === "ai" || service.category === "ذكاء اصطناعي" ? "✦" : service.category === "finance" || service.category === "بيانات مالية" ? "↗" : "◈"}</span><Badge live={live} /></div><div className="service-category">{service.category}</div><h3>{service.name}</h3><p>{service.description}</p><div className="service-endpoint"><span className={service.http_method === "GET" ? "method get" : "method post"}>{service.http_method}</span><code>{service.endpoint_path}</code></div><div className="service-actions"><button className="button button-primary button-small" onClick={onOpen} disabled={!live}>جرّب الآن <span>←</span></button><button className="button button-quiet button-small" onClick={onDocs}>التوثيق</button></div></article>; }
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) { return <div className="stat-card"><span className="stat-icon">{icon}</span><small>{label}</small><b>{value}</b><span className="stat-caption">حسب بيانات حسابك</span></div>; }
function AuthPrompt({ onLogin }: { onLogin: () => void }) { return <div className="auth-prompt"><span className="feature-icon purple">⚿</span><h2>سجّل الدخول لعرض بياناتك</h2><p>سجّل الدخول للوصول إلى مفاتيح API وإحصائيات الاستخدام الخاصة بحسابك.</p><button className="button button-primary" onClick={onLogin}>تسجيل الدخول <span>←</span></button></div>; }
function CodeBlock({ code }: { code: string }) { return <pre className="doc-code"><button onClick={() => void navigator.clipboard.writeText(code)}>نسخ ⧉</button><code>{code}</code></pre>; }
