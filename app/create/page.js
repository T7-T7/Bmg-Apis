"use client";
import {useState} from "react";
export default function CreatePage(){
 const [method,setMethod]=useState("GET");const [name,setName]=useState("");const [slug,setSlug]=useState("");const [description,setDescription]=useState("");const [route,setRoute]=useState("/api/v1/my-endpoint");const [category,setCategory]=useState("Utilities");
 const [done,setDone]=useState(false);
 return <>
 <div className="page-heading"><div><div className="eyebrow">API BUILDER / PREVIEW</div><h1>Create API</h1><p>Design an endpoint definition with a guided builder. This preview stores nothing yet.</p></div></div>
 <div className="builder-steps"><span className="builder-step active">01 · Basic details</span><span className="builder-step">02 · Endpoint</span><span className="builder-step">03 · Inputs</span><span className="builder-step">04 · Response</span><span className="builder-step">05 · Test & Publish</span></div>
 <div className="builder-layout"><section className="panel"><div className="section-title" style={{marginTop:0}}><div><h2>Basic information</h2><p>Describe your API so developers understand it.</p></div></div>
 <div className="form-grid">
 <div className="form-field"><label>API name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Weather API"/></div>
 <div className="form-field"><label>Slug</label><input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="weather-api"/></div>
 <div className="form-field"><label>Category</label><select value={category} onChange={e=>setCategory(e.target.value)}>{["AI","Media","Text","Utilities","Entertainment","Other"].map(x=><option key={x}>{x}</option>)}</select></div>
 <div className="form-field"><label>HTTP Method</label><select value={method} onChange={e=>setMethod(e.target.value)}>{["GET","POST","PUT","PATCH","DELETE"].map(x=><option key={x}>{x}</option>)}</select></div>
 <div className="form-field full"><label>Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What does this API do?"/></div>
 <div className="form-field full"><label>Endpoint path</label><input value={route} onChange={e=>setRoute(e.target.value)} placeholder="/api/v1/your-route"/></div>
 </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:15}}><button className="primary-btn" onClick={()=>setDone(true)}>Preview definition →</button></div>
 {done&&<div className="panel" style={{marginTop:15,borderColor:"#473465"}}><div className="section-title" style={{marginTop:0}}><h2>Definition preview</h2></div><pre className="code-block">{JSON.stringify({name,slug,description,category,method,endpoint:route},null,2)}</pre><p style={{fontSize:10,color:"var(--muted)"}}>This is a frontend-only preview. Publishing and endpoint generation are not wired up.</p></div>}
 </section>
 <aside className="panel"><div className="section-title" style={{marginTop:0}}><div><h2>Endpoint preview</h2><p>Route summary</p></div></div><div className="endpoint">{method} {route}</div><div className="muted-box" style={{marginTop:12}}>Builder preview only. In a later phase, the server will validate and save definitions, create routes, and publish endpoints securely.</div><div className="section-title"><div><h2>Next steps</h2><p>Planned builder workflow</p></div></div><div className="status-row"><span className="status-dot" style={{background:"#a78bfa"}}/><div className="status-meta">Configure parameters</div></div><div className="status-row"><span className="status-dot" style={{background:"#a78bfa"}}/><div className="status-meta">Define response schema</div></div><div className="status-row"><span className="status-dot" style={{background:"#a78bfa"}}/><div className="status-meta">Run test request</div></div><div className="status-row"><span className="status-dot" style={{background:"#a78bfa"}}/><div className="status-meta">Publish endpoint</div></div></aside></div>
 </>;
}