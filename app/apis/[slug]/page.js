import Link from "next/link";
import { apiCatalog } from "@/lib/api-data";
export default async function ApiDetail({params}){
 const {slug}=await params;const api=apiCatalog.find(a=>a.slug===slug);
 if(!api)return <div className="empty-state">API not found. <Link href="/apis">Back to catalog</Link></div>;
 const sample={status:"success",data:{example:"Demo response"},message:"This sample is illustrative"};
 return <>
 <div className="page-heading"><div><div className="eyebrow">API DETAILS / {api.category.toUpperCase()}</div><h1>{api.name}</h1><p>{api.description}</p></div><Link className="secondary-btn" href="/apis">← Catalog</Link></div>
 <div className="panel" style={{marginBottom:14}}><div className="api-card-head"><div className="api-symbol">{api.symbol}</div><div><div className="api-name">{api.name}</div><div className="api-category">{api.category} · {api.status}</div></div></div><div className="endpoint">{api.endpoint}</div><div style={{marginTop:10}}><span className="method">{api.method}</span></div></div>
 <div className="section-title"><div><h2>Endpoint</h2><p>Example route · Not connected yet</p></div></div><div className="panel"><div className="endpoint">{api.endpoint}</div><p style={{fontSize:10,color:"var(--muted)",lineHeight:1.7}}>Authentication, parameters and live execution will be configured during the backend phase.</p></div>
 <div className="section-title"><div><h2>Example response</h2><p>Illustrative JSON preview</p></div></div><pre className="code-block">{JSON.stringify(sample,null,2)}</pre>
 <div className="section-title"><div><h2>JavaScript example</h2><p>Sample client request</p></div></div><pre className="code-block">{`fetch("https://your-domain.example${api.endpoint}")\n  .then(response => response.json())\n  .then(data => console.log(data));`}</pre>
 </>;
}