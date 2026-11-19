"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowUpLeft, BookOpen, Boxes, ChevronLeft, Command, FileCode2, LayoutDashboard, Menu, Search, ShieldCheck, Users, X } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "المنصة", items: [
    { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
    { href: "/apis", label: "كتالوج API", icon: Boxes },
    { href: "/status", label: "حالة الخدمات", icon: Activity },
  ]},
  { label: "المطورون", items: [
    { href: "/create", label: "اقترح واجهة", icon: Users },
    { href: "/my-apis", label: "مساهماتي", icon: FileCode2 },
    { href: "/docs", label: "التوثيق", icon: BookOpen },
  ]},
];

export default function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const current = pathname === "/" ? "نظرة عامة" : pathname.startsWith("/apis/") ? "تفاصيل الواجهة" : groups.flatMap(group => group.items).find(item => item.href === pathname)?.label ?? "BMG APIs";

  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => {
    if (pathname !== "/") {
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "ar";
      document.documentElement.dataset.locale = "ar";
    }
  }, [pathname]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(value => !value); }
      if (event.key === "Escape") { setSearchOpen(false); setMenuOpen(false); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (pathname === "/" || pathname === "/docs" || pathname === "/login" || pathname === "/signup") return <>{children}</>;

  return (
    <div className="app-frame">
      {menuOpen && <button className="sidebar-scrim" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label="القائمة الرئيسية">
        <Link href="/" className="brand"><span className="brand-mark"><Image src="/bmg-apis-mark.svg" width={38} height={38} alt="" priority /></span><span className="brand-copy"><strong>BMG <i>APIs</i></strong><small>بوابة واجهات البرمجة</small></span></Link>
        <div className="workspace-switch"><span className="workspace-avatar">B</span><span><strong>BMG APIs</strong><small>كتالوج الخدمات</small></span><ChevronLeft size={15} /></div>
        <div className="sidebar-groups">
          {groups.map(group => <section className="nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map(item => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || (item.href === "/apis" && pathname.startsWith("/apis/"));
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{active && <span className="nav-active-mark" />}</Link>;
          })}</section>)}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-callout"><span className="callout-icon"><ShieldCheck size={15} /></span><strong>المساهمات تمر بالمراجعة</strong><p>لا تُنشر أي واجهة يضيفها المجتمع قبل اعتماد المشرف.</p><Link href="/create">إرسال مساهمة <ArrowUpLeft size={13} /></Link></div>
          <div className="sidebar-profile"><span className="profile-avatar">B</span><span><strong>حساب المطور</strong><small>تسجيل الدخول أو إنشاء حساب</small></span><Link href="/login" aria-label="تسجيل الدخول"><ArrowUpLeft size={15} /></Link></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-start"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={menuOpen}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button><div className="breadcrumbs"><span>المنصة</span><ChevronLeft size={14} /><strong>{current}</strong></div></div>
          <div className="topbar-actions"><ThemeToggle /><button className="quick-search" onClick={() => setSearchOpen(true)}><Search size={15} /><span>بحث سريع...</span><kbd><Command size={10} /> K</kbd></button><Link href="/docs" className="top-docs"><BookOpen size={15} /><span>التوثيق</span></Link><Link href="/dashboard/api-keys" className="top-create"><ShieldCheck size={15} /><span>مفاتيح API</span></Link><Link href="/login" className="top-docs"><span>دخول</span></Link></div>
        </header>
        {searchOpen && <div className="command-overlay" role="dialog" aria-modal="true" aria-label="البحث السريع" onMouseDown={event => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="command-panel"><div className="command-input"><Search size={18} /><input autoFocus placeholder="ابحث أو اكتب اسم القسم..." onKeyDown={event => { if (event.key === "Enter") { const value = event.currentTarget.value.trim(); if (/api|واجهة|كتالوج/i.test(value)) window.location.href = "/apis"; else if (/مساهمة|اقتراح|إضافة/i.test(value)) window.location.href = "/create"; else if (/توثيق|docs/i.test(value)) window.location.href = "/docs"; else if (/حالة|status/i.test(value)) window.location.href = "/status"; else window.location.href = "/"; } }} /><kbd>ESC</kbd></div><div className="command-hint">انتقال سريع إلى أقسام المنصة</div>{groups.flatMap(group => group.items).map(item => { const Icon = item.icon; return <Link className="command-link" href={item.href} key={item.href} onClick={() => setSearchOpen(false)}><Icon size={16} /><span>{item.label}</span><ArrowUpLeft size={13} /></Link>; })}</div></div>}
        <div className="page-content">{children}</div>
        <footer className="app-footer"><span>© 2026 BMG APIs</span><span><i className="footer-status" /> نسخة الواجهة — خدمات التشغيل قيد التنفيذ</span></footer>
      </main>
    </div>
  );
}
