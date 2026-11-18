import Link from "next/link";
export default function ApiCard({ api }) {
  return <article className="api-card">
    <div className="api-card-head"><div className="api-symbol">{api.symbol}</div><div><div className="api-name">{api.name}</div><div className="api-category">{api.category}</div></div></div>
    <p className="api-description">{api.description}</p>
    <div className="endpoint">{api.endpoint}</div>
    <div className="api-footer"><span className="method">{api.method}</span><div className="api-links"><Link className="mini-btn" href={`/apis/${api.slug}`}>Details</Link><Link className="mini-btn" href="/docs">Docs ↗</Link></div></div>
  </article>;
}