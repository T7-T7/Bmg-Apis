"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowRight, ArrowUpLeft, ArrowUpRight, BookOpen, Braces, Check, ChevronDown, Code2, Github, Globe2, KeyRound, Layers3, LockKeyhole, Menu, ShieldCheck, Sparkles, Terminal, Workflow, X, Zap } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

type Locale = "ar" | "en";

const content = {
  ar: {
    announcement: "مساحة واحدة لبناء تكاملاتك", nav: ["المنصة", "المميزات", "الأسئلة الشائعة", "التوثيق"],
    signIn: "تسجيل الدخول", getStarted: "ابدأ الآن", eyebrow: "بوابة المطورين · API WORKSPACE",
    titleA: "ابنِ أسرع.", titleB: "اربط بذكاء.",
    intro: "واجهات برمجية واضحة، ومفاتيح وصول تحت سيطرتك، وتجربة مطور تختصر الطريق من الفكرة إلى أول طلب ناجح.",
    explore: "استكشف الواجهات", createKey: "أنشئ مفتاح API", live: "بوابة المطورين متاحة",
    featuresEyebrow: "مصممة للمطورين", featuresTitle: "كل ما تحتاجه. دون ضجيج.",
    featuresIntro: "مساحة عمل تجمع اكتشاف الواجهات وإدارة الوصول والتوثيق في تجربة واحدة.",
    features: [
      { title: "كتالوج واضح", desc: "استكشف تعريفات الواجهات وطرق HTTP والمسارات والتصنيفات من مكان واحد.", tag: "DISCOVER", icon: Layers3 },
      { title: "مفاتيح وصول آمنة", desc: "أنشئ مفاتيحك وألغها عند الحاجة. تُحفظ بصمة SHA-256 فقط، وتظهر القيمة الكاملة مرة واحدة.", tag: "ACCESS", icon: LockKeyhole },
      { title: "توثيق عملي", desc: "أمثلة طلبات واستجابات تساعدك على فهم طريقة الربط قبل كتابة التكامل.", tag: "DOCS", icon: BookOpen },
      { title: "اختبار الخدمة", desc: "ابدأ باستخدام الخدمة المتصلة حاليًا، وتابع الاستجابة ورمز HTTP بوضوح.", tag: "TEST", icon: Terminal },
      { title: "مساهمات بمراجعة", desc: "اقترح واجهة للمجتمع. لا تُنشر مساهمات المستخدمين تلقائيًا قبل مراجعتها.", tag: "COMMUNITY", icon: ShieldCheck },
      { title: "أساس قابل للتوسع", desc: "بنية مبنية على Next.js وSupabase مع فصل الواجهة عن صلاحيات الخدمات.", tag: "STACK", icon: Workflow }
    ],
    flowEyebrow: "ابدأ في ثلاث خطوات", flowTitle: "من الحساب إلى أول طلب.",
    flow: [["01", "أنشئ حسابك", "سجّل باستخدام Google للوصول إلى مساحة المطور."], ["02", "ولّد مفتاحك", "أنشئ مفتاح API واحتفظ به في بيئة الخادم."], ["03", "أرسل طلبك", "استخدم المفتاح في Authorization: Bearer وابدأ التكامل."]],
    faqEyebrow: "إجابات واضحة", faqTitle: "قبل أن تبدأ.",
    faqs: [
      ["هل جميع الواجهات في الكتالوج جاهزة؟", "ليس بعد. الكتالوج يحتوي على تعريفات ونماذج، والخدمة التشغيلية المتصلة حاليًا هي Gemini. وجود بطاقة لا يعني أن API جاهزة للتشغيل."],
      ["كيف أحصل على مفتاح API؟", "سجّل الدخول باستخدام Google، ثم افتح مفاتيح API وأنشئ مفتاحًا باسم يوضح المشروع. تظهر القيمة الكاملة مرة واحدة فقط."],
      ["هل يتم حفظ المفتاح الأصلي؟", "لا. يتم حفظ بصمة SHA-256 فقط. احتفظ بالقيمة الكاملة في متغير بيئة خادمي ولا تضعها في الواجهة الأمامية أو مستودع عام."],
      ["هل يمكنني إضافة API من عندي؟", "يمكنك إرسال مساهمة للمراجعة. كود الاختبار يُحفظ للمراجعة ولا يتم تشغيله مباشرة على خادم الإنتاج."]
    ],
    ctaEyebrow: "جاهز للبدء؟", ctaTitle: "خلّ التكامل يبدأ من هنا.",
    ctaText: "أنشئ حساب المطور، ولّد مفتاحك، واستخدم الخدمة المتاحة.", ctaButton: "افتح مساحة المطور",
    footerText: "مساحة أدوات وواجهات برمجية للمطورين.", footerLinks: ["الكتالوج", "التوثيق", "حالة الخدمات", "المساهمة"], rights: "جميع الحقوق محفوظة."
  },
  en: {
    announcement: "One workspace for your integrations", nav: ["Platform", "Features", "FAQ", "Docs"],
    signIn: "Sign in", getStarted: "Get started", eyebrow: "DEVELOPER GATEWAY · API WORKSPACE",
    titleA: "Build faster.", titleB: "Connect smarter.",
    intro: "Clear API references, access keys you control, and a developer experience designed to shorten the path from an idea to your first successful request.",
    explore: "Explore APIs", createKey: "Create API key", live: "Developer gateway online",
    featuresEyebrow: "BUILT FOR DEVELOPERS", featuresTitle: "Everything you need. Nothing noisy.",
    featuresIntro: "Discover APIs, manage access, and read documentation in one focused workspace.",
    features: [
      { title: "Clear API catalog", desc: "Explore API references, HTTP methods, routes, and categories in one place.", tag: "DISCOVER", icon: Layers3 },
      { title: "Secure access keys", desc: "Create and revoke keys. Only SHA-256 fingerprints are stored; the full value is shown once.", tag: "ACCESS", icon: LockKeyhole },
      { title: "Practical docs", desc: "Request and response examples help you understand an integration before writing it.", tag: "DOCS", icon: BookOpen },
      { title: "Service testing", desc: "Start with the currently connected service and inspect its response and HTTP status.", tag: "TEST", icon: Terminal },
      { title: "Reviewed contributions", desc: "Submit an API for review. Community submissions are not published automatically.", tag: "COMMUNITY", icon: ShieldCheck },
      { title: "Scalable foundation", desc: "Built with Next.js and Supabase, separating the interface from service permissions.", tag: "STACK", icon: Workflow }
    ],
    flowEyebrow: "THREE STEPS TO START", flowTitle: "From account to first request.",
    flow: [["01", "Create your account", "Continue with Google to access your developer workspace."], ["02", "Generate a key", "Create an API key and keep it server-side."], ["03", "Send your request", "Use Authorization: Bearer and start integrating."]],
    faqEyebrow: "STRAIGHT ANSWERS", faqTitle: "Before you begin.",
    faqs: [
      ["Are all APIs in the catalog ready?", "Not yet. The catalog contains references and examples; Gemini is currently the connected operational service. A catalog card does not mean an API is live."],
      ["How do I get an API key?", "Sign in with Google, open API Keys, and create a key with a label for your project. The full value is shown only once."],
      ["Is the original key stored?", "No. Only a SHA-256 fingerprint is stored. Keep the full value in a server-side environment variable, never in frontend code or a public repository."],
      ["Can I submit my own API?", "You can submit a contribution for review. Test code is stored for review and is not executed directly on the production server."]
    ],
    ctaEyebrow: "READY WHEN YOU ARE", ctaTitle: "Let your next integration start here.",
    ctaText: "Create a developer account, generate a key, and use the connected service.", ctaButton: "Open developer workspace",
    footerText: "A focused workspace for developer APIs and tools.", footerLinks: ["Catalog", "Documentation", "Service status", "Contribute"], rights: "All rights reserved."
  }
};

const reveal = { hidden: { opacity: 0, y: 26 }, visible: { opacity: 1, y: 0, transition: { duration: .62, ease: "easeOut" } } };

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [menuOpen, setMenuOpen] = useState(false);
  const t = content[locale];
  const ar = locale === "ar";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.documentElement.dataset.locale = locale;
  }, [locale, ar]);

  const navLinks = [
    { href: "#platform", label: t.nav[0] },
    { href: "#features", label: t.nav[1] },
    { href: "#faq", label: t.nav[2] },
    { href: "/docs", label: t.nav[3] }
  ];

  return (
    <main className="landing-page" dir={ar ? "rtl" : "ltr"}>
      <div className="landing-ambient" aria-hidden="true"><span className="ambient-orb ambient-orb-one" /><span className="ambient-orb ambient-orb-two" /><span className="ambient-grid" /></div>
      <div className="announcement-bar"><span className="announcement-spark"><Sparkles size={13} /></span><span>{t.announcement}</span><span className="announcement-dot" /><span className="announcement-version">BMG APIs / 0.4</span></div>

      <header className="landing-nav-wrap">
        <nav className="landing-nav glass-panel" aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}>
          <Link href="/" className="landing-brand" aria-label="BMG APIs"><span className="landing-brand-mark"><Braces size={22} strokeWidth={2.2} /></span><span className="landing-brand-name">BMG<span>APIs</span><small>DEVELOPER GATEWAY</small></span></Link>
          <div className="landing-nav-links">{navLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</div>
          <div className="landing-nav-actions">
            <button className="locale-toggle" onClick={() => setLocale(value => value === "ar" ? "en" : "ar")} type="button" aria-label="Change language"><Globe2 size={15} /><span>{ar ? "EN" : "عربي"}</span></button>
            <ThemeToggle />
            <Link href="/login" className="nav-signin">{t.signIn}</Link>
            <Link href="/signup?next=/dashboard/api-keys" className="nav-cta">{t.getStarted}<ArrowUpRight size={15} /></Link>
          </div>
          <button className="landing-mobile-toggle" type="button" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </nav>
        <AnimatePresence>
          {menuOpen && <motion.div className="mobile-nav-panel glass-panel" initial={{ opacity: 0, y: -10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: .98 }} transition={{ duration: .2 }}>
            {navLinks.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpLeft size={14} /></a>)}
            <div className="mobile-nav-actions"><button className="locale-toggle" onClick={() => setLocale(value => value === "ar" ? "en" : "ar")}><Globe2 size={15} />{ar ? "English" : "العربية"}</button><ThemeToggle /><Link href="/signup?next=/dashboard/api-keys" className="nav-cta">{t.getStarted}<ArrowUpRight size={15} /></Link></div>
          </motion.div>}
        </AnimatePresence>
      </header>

      <section className="landing-hero" id="platform">
        <div className="hero-copy">
          <motion.div className="hero-eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}><span className="hero-eyebrow-icon"><Zap size={14} fill="currentColor" /></span>{t.eyebrow}<span className="hero-eyebrow-line" /></motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .08, ease: [0.22, 1, 0.36, 1] }}>{t.titleA}<br /><span>{t.titleB}</span></motion.h1>
          <motion.p className="hero-description" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .18 }}>{t.intro}</motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .28 }}>
            <Link href="/apis" className="hero-button hero-button-primary">{t.explore}{ar ? <ArrowUpLeft size={17} /> : <ArrowRight size={17} />}</Link>
            <Link href="/signup?next=/dashboard/api-keys" className="hero-button hero-button-secondary"><KeyRound size={16} />{t.createKey}</Link>
          </motion.div>
          <motion.div className="hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .55 }}><span className="proof-status"><i />{t.live}</span><span className="proof-divider" /><span className="proof-label">REST <b>·</b> JSON <b>·</b> HTTP</span></motion.div>
        </div>

        <motion.div className="hero-visual" initial={{ opacity: 0, scale: .94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .85, delay: .18, ease: [0.22, 1, 0.36, 1] }}>
          <div className="visual-orbit visual-orbit-a" /><div className="visual-orbit visual-orbit-b" />
          <div className="visual-float visual-float-top"><span className="float-icon"><ShieldCheck size={15} /></span><span>AUTHENTICATED</span><i /></div>
          <div className="code-window glass-panel">
            <div className="code-window-top"><div className="window-dots"><i /><i /><i /></div><span className="window-file"><Terminal size={13} /> request.ts</span><span className="window-language">TYPESCRIPT</span></div>
            <div className="code-window-body" dir="ltr">
              <div className="code-line"><span className="line-number">01</span><span><b className="code-pink">const</b> <b className="code-lime">response</b> = <b className="code-blue">await</b> fetch(</span></div>
              <div className="code-line"><span className="line-number">02</span><span className="code-string">  "https://bmg-apis.vercel.app/api/v1/ai/gemini",</span></div>
              <div className="code-line"><span className="line-number">03</span><span>  {"{"}</span></div>
              <div className="code-line"><span className="line-number">04</span><span>    method: <b className="code-string">"POST"</b>,</span></div>
              <div className="code-line"><span className="line-number">05</span><span>    headers: {"{"}</span></div>
              <div className="code-line"><span className="line-number">06</span><span>      Authorization: <b className="code-string">"Bearer YOUR_KEY"</b></span></div>
              <div className="code-line"><span className="line-number">07</span><span>    {"}"},</span></div>
              <div className="code-line"><span className="line-number">08</span><span>    body: JSON.stringify({"{"} prompt {"}"})</span></div>
              <div className="code-line"><span className="line-number">09</span><span>  {"}"}</span></div>
              <div className="code-line"><span className="line-number">10</span><span>);</span></div>
            </div>
            <div className="code-window-bottom"><span><span className="terminal-live-dot" />{ar ? "استجابة تجريبية" : "SAMPLE RESPONSE"}</span><span className="response-status"><Check size={12} /> HTTP 200</span></div>
          </div>
          <motion.div className="visual-float visual-float-bottom" animate={{ y: [0, -7, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}><span className="float-method">POST</span><span>/api/v1/ai/gemini</span><span className="float-arrow">↗</span></motion.div>
          <div className="visual-glow" />
        </motion.div>
      </section>

      <section className="trust-strip"><span>{ar ? "مبنية على معايير الويب" : "BUILT ON WEB STANDARDS"}</span><div><b>REST</b><i /><b>JSON</b><i /><b>HTTP</b><i /><b>OAuth</b><i /><b>SHA-256</b></div><span className="trust-right"><Activity size={13} />{ar ? "وضوح في حالة التنفيذ" : "HONEST IMPLEMENTATION STATUS"}</span></section>

      <motion.section className="features-section" id="features" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="section-intro"><span className="section-kicker"><span />{t.featuresEyebrow}</span><h2>{t.featuresTitle}</h2><p>{t.featuresIntro}</p></div>
        <div className="feature-grid">{t.features.map((feature, index) => { const Icon = feature.icon; return <motion.article className={"feature-card feature-card-" + (index + 1) + " glass-panel"} key={feature.tag} whileHover={{ y: -6, transition: { duration: .22 } }}><div className="feature-card-top"><span className={"feature-icon feature-icon-" + (index + 1)}><Icon size={20} strokeWidth={1.8} /></span><span className="feature-tag">{feature.tag}</span></div><div className="feature-card-copy"><h3>{feature.title}</h3><p>{feature.desc}</p></div><span className="feature-card-index">0{index + 1}</span><span className="feature-card-orb" /></motion.article>; })}</div>
      </motion.section>

      <motion.section className="flow-section" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .15 }}>
        <div className="flow-heading"><span className="section-kicker"><span />{t.flowEyebrow}</span><h2>{t.flowTitle}</h2></div>
        <div className="flow-steps">{t.flow.map(([number, title, desc], index) => <motion.article className="flow-step" key={number} whileHover={{ y: -4 }}><span className="flow-number">{number}</span><div className="flow-step-icon">{index === 0 ? <Globe2 size={19} /> : index === 1 ? <KeyRound size={19} /> : <Code2 size={19} />}</div><h3>{title}</h3><p>{desc}</p>{index !== 2 && <span className="flow-connector"><ArrowRight size={15} /></span>}</motion.article>)}</div>
      </motion.section>

      <motion.section className="faq-section" id="faq" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .12 }}>
        <div className="faq-heading"><span className="section-kicker"><span />{t.faqEyebrow}</span><h2>{t.faqTitle}</h2></div>
        <div className="faq-list">{t.faqs.map(([question, answer], index) => <details className="faq-item glass-panel" key={question} open={index === 0}><summary><span className="faq-index">0{index + 1}</span><span>{question}</span><ChevronDown size={17} /></summary><p>{answer}</p></details>)}</div>
      </motion.section>

      <motion.section className="final-cta glass-panel" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .25 }}>
        <div className="cta-orb cta-orb-one" /><div className="cta-orb cta-orb-two" />
        <div className="final-cta-copy"><span className="section-kicker"><span />{t.ctaEyebrow}</span><h2>{t.ctaTitle}</h2><p>{t.ctaText}</p></div>
        <Link href="/signup?next=/dashboard/api-keys" className="hero-button hero-button-primary">{t.ctaButton}{ar ? <ArrowUpLeft size={17} /> : <ArrowRight size={17} />}</Link>
      </motion.section>

      <footer className="landing-footer">
        <div className="footer-main">
          <div className="footer-brand-block"><Link href="/" className="landing-brand"><span className="landing-brand-mark"><Braces size={22} /></span><span className="landing-brand-name">BMG<span>APIs</span><small>DEVELOPER GATEWAY</small></span></Link><p>{t.footerText}</p></div>
          <div className="footer-link-group"><strong>{ar ? "استكشف" : "EXPLORE"}</strong><Link href="/apis">{t.footerLinks[0]}</Link><Link href="/docs">{t.footerLinks[1]}</Link></div>
          <div className="footer-link-group"><strong>{ar ? "المطورون" : "DEVELOPERS"}</strong><Link href="/status">{t.footerLinks[2]}</Link><Link href="/create">{t.footerLinks[3]}</Link><Link href="/dashboard/api-keys">{ar ? "مفاتيح API" : "API keys"}</Link></div>
          <div className="footer-link-group"><strong>{ar ? "الحساب" : "ACCOUNT"}</strong><Link href="/login">{t.signIn}</Link><Link href="/signup">{t.getStarted}</Link></div>
        </div>
        <div className="footer-bottom"><span>© 2026 BMG APIs. {t.rights}</span><span className="footer-built"><span />{ar ? "مبني للمطورين" : "BUILT FOR BUILDERS"}</span><a href="https://github.com/T7-T7/Bmg-Apis" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={17} /></a></div>
      </footer>
    </main>
  );
}
