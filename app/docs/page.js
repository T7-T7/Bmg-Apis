import Link from "next/link";
export default function DocsPage(){return <>
<div className="page-heading"><div><div className="eyebrow">DEVELOPER GUIDE</div><h1>Documentation</h1><p>Learn the platform concepts and how APIs will be integrated.</p></div></div>
<div className="card-grid">
{[{title:"Quick start",text:"Explore the catalog, inspect an endpoint and read the sample request.",href:"/apis"},{title:"API Builder",text:"Draft a definition, choose a route and HTTP method, and preview its configuration.",href:"/create"},{title:"API lifecycle",text:"Draft, test, publish, version and manage APIs from your workspace.",href:"/my-apis"}].map(c=><div className="panel" key={c.title}><h3 style={{fontSize:12,marginTop:0}}>{c.title}</h3><p style={{fontSize:10,color:"var(--muted)",lineHeight:1.8}}>{c.text}</p><Link href={c.href} className="mini-btn">Open section →</Link></div>)}
</div>
<div className="section-title"><div><h2>Request example</h2><p>Illustrative request pattern</p></div></div>
<pre className="code-block">{`// Example only — no live API is connected yet\nfetch("https://api.example.com/api/v1/echo?message=hello")\n  .then((res) => res.json())\n  .then((data) => console.log(data));`}</pre>
<div className="section-title"><div><h2>Example response</h2><p>JSON</p></div></div>
<pre className="code-block">{JSON.stringify({status:"success",data:{message:"hello"},requestId:"demo-request"},null,2)}</pre>
</>}