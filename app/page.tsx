import Link from "next/link";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories } from "@/lib/api-data";

const stats = [
  { label: "Sample APIs", value: String(apiCatalog.length).padStart(2, "0"), icon: "⌘", note: "Frontend catalog preview" },
  { label: "Live endpoints", value: "00", icon: "◉", note: "Backend not connected" },
  { label: "Categories", value: String(categories.length - 1).padStart(2, "0"), icon: "▦", note: "Catalog categories" },
  { label: "Platform", value: "Preview", icon: "⌁", note: "Interface stage" },
];

export default function DashboardPage() {
  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="live-label"><span className="live-dot" /> DEVELOPER API PLATFORM · UI PREVIEW</div>
          <h1>Build faster with<br /><span>APIs made simple.</span></h1>
          <p>Discover APIs, explore their documentation, and design your own endpoints in one developer workspace.</p>
          <div className="hero-buttons"><Link className="primary-btn" href="/apis">Explore API Catalog ↗</Link><Link className="secondary-btn" href="/create">Create an API +</Link></div>
        </div>
      </section>
      <section className="stats-grid">{stats.map(stat => (
        <div className="stat-card" key={stat.label}><div className="stat-head"><span>{stat.label}</span><span className="stat-icon">{stat.icon}</span></div><div className="stat-value">{stat.value}</div><div className="stat-note">{stat.note}</div></div>
      ))}</section>
      <div className="section-title"><div><h2>Featured APIs</h2><p>Sample cards from the interface prototype</p></div><Link href="/apis">View catalog →</Link></div>
      <div className="card-grid">{apiCatalog.slice(0, 3).map(api => <ApiCard api={api} key={api.slug} />)}</div>
      <div className="section-title"><div><h2>Start building</h2><p>Draft your API definition using the visual builder</p></div></div>
      <div className="panel start-panel"><div><strong>Design your first API</strong><p>Configure its route, request method, inputs and response sample.</p></div><Link href="/create" className="primary-btn">Open Builder ↗</Link></div>
    </>
  );
}