"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity, ArrowUpLeft, BookOpen, Boxes, Braces, ChevronLeft,
  CirclePlus, Code2, Command, FileCode2, LayoutDashboard,
  Menu, X, Zap,
} from "lucide-react";

type NavLink = { href: string; name: string; icon: typeof LayoutDashboard; count?: string };
type NavSection = { label: string; links: NavLink[] };

const navigation: NavSection[] = [
  { label: "الرئيسية", links: [
    { href: "/", name: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/apis", name: "استكشاف الواجهات", icon: Boxes, count: "06" },
    { href: "/status", name: "حالة الخدمات", icon: Activity },
  ]},
  { label: "مساحة العمل", links: [
    { href: "/create", name: "إنشاء واجهة API", icon: CirclePlus },
    { href: "/my-apis", name: "واجهاتي", icon: FileCode2 },
    { href: "/docs", name: "التوثيق", icon: BookOpen },
  ]},
];

export default function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = pathname === "/" ? "لوحة التحكم" : pathname.startsWith("/apis/") ? "تفاصيل الواجهة" :
    navigation.flatMap(section => section.links).find(item => item.href === pathname)?.name ?? "المنصة";

  return (
    <div className="shell">
      {menuOpen && <button className="sidebar-backdrop" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <Image className="brand-mark-image" src="/bmg-apis-mark.svg" width={38} height={38} alt="شعار BMG APIs" priority />
          <span className="brand-copy">
            <span className="brand-title">BMG <span>APIs</span></span>
            <span className="brand-sub">منصة المطورين</span>
          </span>
        </Link>
        {navigation.map(section => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.links.map(item => {
              const active = item.href === "/" ? pathname === "/" :
                pathname === item.href || (item.href === "/apis" && pathname.startsWith("/apis/"));
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined}>
                  <span className="nav-icon" aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>
                  <span>{item.name}</span>
                  {item.count && <span className="nav-count">{item.count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="side-bottom">
          <div className="side-promo">
            <div className="promo-icon"><Zap size={16} /></div>
            <strong>ابدأ بناء واجهتك</strong>
            <p>جهّز تعريف واجهة البرمجة الخاصة بك من مساحة العمل.</p>
            <Link href="/create" onClick={() => setMenuOpen(false)}>فتح منشئ الواجهات <ChevronLeft size={13} /></Link>
          </div>
          <div className="side-foot">BMG APIs · نسخة معاينة</div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="top-btn menu-toggle" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={menuOpen}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="breadcrumb"><span>BMG APIs</span><ChevronLeft size={13} /><strong>{current}</strong></div>
          </div>
          <div className="top-actions">
            <Link href="/docs" className="top-btn"><BookOpen size={14} /> التوثيق</Link>
            <Link href="/create" className="top-btn top-create"><CirclePlus size={14} /> إنشاء واجهة</Link>
          </div>
        </header>
        {children}
        <footer className="footer"><span>© 2026 BMG APIs · جميع الحقوق محفوظة</span><span>معاينة الواجهة · الخادم غير متصل بعد</span></footer>
      </main>
    </div>
  );
}