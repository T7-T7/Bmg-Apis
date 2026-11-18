"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type NavLink = { href: string; name: string; icon: string; count?: string };
type NavSection = { label: string; links: NavLink[] };

const navigation: NavSection[] = [
  { label: "Overview", links: [
    { href: "/", name: "Dashboard", icon: "⌂" },
    { href: "/apis", name: "Explore APIs", icon: "⌘", count: "06" },
    { href: "/status", name: "Service Status", icon: "◉" },
  ]},
  { label: "Workspace", links: [
    { href: "/create", name: "Create API", icon: "＋" },
    { href: "/my-apis", name: "My APIs", icon: "▤" },
    { href: "/docs", name: "Documentation", icon: "▧" },
  ]},
];

export default function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = pathname === "/" ? "Dashboard" : pathname.startsWith("/apis/") ? "API Details" :
    navigation.flatMap(section => section.links).find(item => item.href === pathname)?.name ?? "Platform";

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-copy">
            <span className="brand-title">BMG <span>APIs</span></span>
            <span className="brand-sub">Developer Platform</span>
          </span>
        </Link>
        {navigation.map(section => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.links.map(item => {
              const active = item.href === "/" ? pathname === "/" :
                pathname === item.href || (item.href === "/apis" && pathname.startsWith("/apis/"));
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.name}
                  {item.count && <span className="nav-count">{item.count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="side-bottom">
          <div className="side-promo">
            <strong>Build something useful</strong>
            <p>Start building and prepare your own API definitions.</p>
            <Link href="/create">Open API Builder →</Link>
          </div>
          <div className="side-foot">BMG APIs · Preview</div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="top-btn menu-toggle" onClick={() => setMenuOpen(value => !value)} aria-label="Toggle navigation" aria-expanded={menuOpen}>☰</button>
            <div className="breadcrumb">BMG APIs / <strong>{current}</strong></div>
          </div>
          <div className="top-actions">
            <Link href="/docs" className="top-btn">Docs ↗</Link>
            <Link href="/create" className="top-btn">＋ Create API</Link>
          </div>
        </header>
        {children}
        <footer className="footer"><span>© 2026 BMG APIs · Developer platform</span><span>Frontend Preview · Runtime not connected</span></footer>
      </main>
    </div>
  );
}