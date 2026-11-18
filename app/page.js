import Link from "next/link";
import ApiCard from "@/components/api-card";
import { apiCatalog } from "@/lib/api-data";

const stats = [{label:"Available APIs",value:"12",icon:"⌘",note:"Catalog entries"},{label:"Operational",value:"10",icon:"◉",note:"Demo status"},{label:"Categories",value:"06",icon:"▦",note:"Service groups"},{label:"Platform",value:"Preview",icon:"⌁",note:"UI stage"}];

export default function Dashboard() {
  return <>
    <section className="hero"><div className="hero-inner"><div className="live-label"><span className="live-dot"/> DEVELOPER API PLATFORM</div><h1>Build faster with<br/><span>APIs made simple.</span></h1><p>Discover APIs, explore their documentation, and design your own endpoints in one developer workspace.</p><div className="hero-buttons"><Link className="primary-btn" href="/apis">Explore API Catalog ↗</Link><Link className="secondary-btn" href="/create">Create an API +</Link></div></div></section>
    <section className="stats-grid">{stats.map(s=><div className="stat-card" key={s.label}><div className="stat-head"><span>{s.label}</span><span className="stat-icon">{s.icon}</span></div><div className="stat-value">{s.value}</div><div className="stat-note">{s.note}</div></div>)}</section>
    <div className="section-title"><div><h2>Featured APIs</h2><p>Browse a selection from the API catalog</p></div><Link href="/apis">View catalog →</Link></div>
    <div className="card-grid">{apiCatalog.slice(0,3).map(api=><ApiCard api={api} key={api.slug}/>)}</div>
    <div className="section-title"><div><h2>Start building</h2><p>Draft your API definition using the visual builder</p></div></div>
    <div className="panel" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:15,flexWrap:"wrap"}}><div><strong style={{fontSize:12}}>Create your first API</strong><p style={{fontSize:10,color:"var(--muted)",margin:"7px 0 0"}}>Configure its route, request method, inputs and response sample.</p></div><Link href="/create" className="primary-btn">Open Builder ↗</Link></div>
  </>;
}