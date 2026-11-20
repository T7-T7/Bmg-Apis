"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowUpLeft, BookOpen, Boxes, ChevronLeft, CircleDollarSign, Command, FileCode2, FlaskConical, Globe2, LayoutDashboard, Menu, Search, ShieldCheck, Users, X } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import { motion } from "motion/react";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const navEnglish: Record<string, string> = { "/": "Overview", "/apis": "API Catalog", "/status": "Service Status", "/pricing": "Pricing", "/create": "Suggest an API", "/my-apis": "My Contributions", "/docs": "Documentation", "/playground": "Playground", "/dashboard": "Developer Dashboard" };
const groupEnglish: Record<string, string> = { "المنصة": "PLATFORM", "المطورون": "DEVELOPERS" };

const groups: NavGroup[] = [
  { label: "المنصة", items: [
    { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
    { href: "/apis", label: "كتالوج API", icon: Boxes },
    { href: "/status", label: "حالة الخدمات", icon: Activity },
    { href: "/pricing", label: "الأسعار", icon: CircleDollarSign },
  ]},
  { label: "المطورون", items: [
    { href: "/create", label: "اقترح واجهة", icon: Users },
    { href: "/my-apis", label: "مساهماتي", icon: FileCode2 },
    { href: "/docs", label: "التوثيق", icon: BookOpen },
    { href: "/playground", label: "Playground", icon: FlaskConical },
    { href: "/dashboard", label: "لوحة المطور", icon: LayoutDashboard },
  ]},
];

export default function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const currentArabic = pathname === "/" ? "نظرة عامة" : pathname.startsWith("/apis/") ? "تفاصيل الواجهة" : groups.flatMap(group => group.items).find(item => item.href === pathname)?.label ?? "Nox Apis";
  const current = locale === "ar" ? currentArabic : pathname.startsWith("/apis/") ? "API Details" : navEnglish[pathname] ?? "Nox Apis";

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close transient navigation UI after route changes.
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved locale after hydration.
  useEffect(() => {
    const saved = window.localStorage.getItem("nox-apis-locale");
    const next = saved === "en" ? "en" : "ar";
    setLocale(next);
  }, []);
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [pathname, locale]);
  function toggleLocale() {
    const next = locale === "ar" ? "en" : "ar";
    setLocale(next);
    window.localStorage.setItem("nox-apis-locale", next);
    window.dispatchEvent(new Event("nox-locale-change"));
  }
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(value => !value); }
      if (event.key === "Escape") { setSearchOpen(false); setMenuOpen(false); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (pathname === "/" || pathname === "/docs" || pathname === "/login" || pathname === "/signup" || pathname === "/auth/callback") return <>{children}</>;

  return (
    <div className="app-frame">
      {menuOpen && <motion.button className="sidebar-scrim" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} whileTap={{ scale: .97 }} />}
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label={locale === "ar" ? "القائمة الرئيسية" : "Main navigation"}>
        <Link href="/" className="brand"><span className="brand-mark"><Image src="/bmg-apis-mark.svg" width={38} height={38} alt="" priority /></span><span className="brand-copy"><strong>Nox <i>Apis</i></strong><small>Nexus Of Xperience</small></span></Link>
        <div className="workspace-switch"><span className="workspace-avatar">N</span><span><strong>Nox Apis</strong><small>{locale === "ar" ? "كتالوج الخدمات" : "Service catalog"}</small></span><ChevronLeft size={15} /></div>
        <div className="sidebar-groups">
          {groups.map(group => <section className="nav-group" key={group.label}><h2>{locale === "ar" ? group.label : groupEnglish[group.label]}</h2>{group.items.map(item => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || (item.href === "/apis" && pathname.startsWith("/apis/"));
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={17} strokeWidth={1.8} /><span>{locale === "ar" ? item.label : navEnglish[item.href]}</span>{active && <span className="nav-active-mark" />}</Link>;
          })}</section>)}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-callout"><span className="callout-icon"><ShieldCheck size={15} /></span><strong>{locale === "ar" ? "المساهمات تمر بالمراجعة" : "Contributions are reviewed"}</strong><p>{locale === "ar" ? "لا تُنشر أي واجهة يضيفها المجتمع قبل اعتماد المشرف." : "Community APIs are reviewed before publication."}</p><Link href="/create">{locale === "ar" ? "إرسال مساهمة" : "Submit an API"} <ArrowUpLeft size={13} /></Link></div>
          <div className="sidebar-profile"><span className="profile-avatar">N</span><span><strong>{locale === "ar" ? "حساب المطور" : "Developer account"}</strong><small>{locale === "ar" ? "تسجيل الدخول أو إنشاء حساب" : "Sign in or create an account"}</small></span><Link href="/login" aria-label="تسجيل الدخول"><ArrowUpLeft size={15} /></Link></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-start"><motion.button className="icon-button mobile-menu" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={menuOpen} whileTap={{ scale: .97 }}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</motion.button><div className="breadcrumbs"><span>{locale === "ar" ? "المنصة" : "Platform"}</span><ChevronLeft size={14} /><strong>{current}</strong></div></div>
          <div className="topbar-actions"><motion.button className="locale-toggle" type="button" onClick={toggleLocale} aria-label="Change language" whileTap={{ scale: .97 }}><Globe2 size={14}/><span>{locale === "ar" ? "EN" : "عربي"}</span></motion.button><ThemeToggle /><motion.button className="quick-search" onClick={() => setSearchOpen(true)}><Search size={15} /><span>{locale === "ar" ? "بحث سريع..." : "Quick search..."}</span><kbd><Command size={10} /> K</kbd></motion.button><Link href="/docs" className="top-docs"><BookOpen size={15} /><span>{locale === "ar" ? "التوثيق" : "Docs"}</span></Link><Link href="/dashboard" className="top-create"><LayoutDashboard size={15} /><span>{locale === "ar" ? "لوحة المطور" : "Dashboard"}</span></Link><Link href="/login" className="top-docs"><span>{locale === "ar" ? "دخول" : "Sign in"}</span></Link></div>
        </header>
        {searchOpen && <div className="command-overlay" role="dialog" aria-modal="true" aria-label={locale === "ar" ? "البحث السريع" : "Quick search"} onMouseDown={event => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="command-panel"><div className="command-input"><Search size={18} /><input autoFocus placeholder={locale === "ar" ? "ابحث أو اكتب اسم القسم..." : "Search or type a section..."} onKeyDown={event => { if (event.key === "Enter") { const value = event.currentTarget.value.trim(); if (/api|واجهة|كتالوج/i.test(value)) window.location.href = "/apis"; else if (/مساهمة|اقتراح|إضافة/i.test(value)) window.location.href = "/create"; else if (/توثيق|docs/i.test(value)) window.location.href = "/docs"; else if (/playground|تجربة|اختبار/i.test(value)) window.location.href = "/playground"; else if (/سعر|أسعار|pricing/i.test(value)) window.location.href = "/pricing"; else if (/dashboard|لوحة/i.test(value)) window.location.href = "/dashboard"; else if (/حالة|status/i.test(value)) window.location.href = "/status"; else window.location.href = "/"; } }} /><kbd>ESC</kbd></div><div className="command-hint">{locale === "ar" ? "انتقال سريع إلى أقسام المنصة" : "Quick navigation across the platform"}</div>{groups.flatMap(group => group.items).map(item => { const Icon = item.icon; return <Link className="command-link" href={item.href} key={item.href} onClick={() => setSearchOpen(false)}><Icon size={16} /><span>{item.label}</span><ArrowUpLeft size={13} /></Link>; })}</div></div>}
        <div className="page-content">{children}</div>
        <footer className="app-footer"><span>© 2026 Nox Apis</span><span><i className="footer-status" /> {locale === "ar" ? "نسخة الواجهة — خدمات التشغيل قيد التنفيذ" : "Interface release — service rollout in progress"}</span></footer>
      </main>
    </div>
  );
}
