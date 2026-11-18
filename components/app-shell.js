"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { label: "Overview", title: "Platform", links: [
    { href: "/", name: "Dashboard", icon: "⌂" },
    { href: "/apis", name: "Explore APIs", icon: "⌘", count: "06" },
    { href: "/status", name: "Service Status", icon: "◉" }
  ]},
  { label: "Workspace", links: [
    { href: "/create", name: "Create API", icon: "＋" },
    { href: "/my-apis", name: "My APIs", icon: "▤" },
    { href: "/docs", name: "Documentation", icon: "▧" }
  ]}
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = pathname === "/" ? "Dashboard" : pathname.startsWith("/apis/") ? "API Details" :
    nav.flatMap(section => section.links).find(item => item.href === pathname)?.name || "Platform";
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <div className="brand-mark">B</div>
          <div><div className="brand-title">BMG <span>APIs</span></div><div className="brand-sub">Developer Platform</div></div>
        </Link>
        {nav.map(section => <div key={section.label}>
          <div className="nav-label">{section.label}</div>
          {section.links.map(item => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || (item.href === "/apis" && pathname.startsWith("/apis/"));
            return <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setOpen(false)}>
              <span className="nav-icon">{item.icon}</span>{item.name}{item.count && <span className="nav-count">{item.count}</span>}
            </Link>;
          })}
        </div>)}
        <div className="side-bottom">
          <div className="side-promo"><strong>Build something useful</strong><p>Start building and publish your own API through the platform.</p><Link href="/create">Open API Builder →</Link></div>
          <div className="side-foot">BMG APIs · Preview</div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="top-btn menu-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation">☰</button>
            <div className="breadcrumb">BMG APIs / <strong>{current}</strong></div>
          </div>
          <div className="top-actions"><Link href="/docs" className="top-btn">Docs ↗</Link><Link href="/create" className="top-btn">＋ Create API</Link></div>
        </header>
        {children}
        <footer className="footer"><span>© 2026 BMG APIs · Developer platform</span><span>Interface Preview · API runtime not connected</span></footer>
      </main>
    </div>
  );
}