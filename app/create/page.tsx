"use client";

import { useState } from "react";
import type { HttpMethod, ApiCategory } from "@/lib/api-data";

type ApiDraft = { name: string; slug: string; description: string; category: ApiCategory; method: HttpMethod; endpoint: string };

export default function CreatePage() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [endpoint, setEndpoint] = useState("/api/v1/my-endpoint");
  const [category, setCategory] = useState<ApiCategory>("Utilities");
  const [preview, setPreview] = useState<ApiDraft | null>(null);

  function showPreview() {
    setPreview({ name, slug, description, category, method, endpoint });
  }

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">API BUILDER / PREVIEW</div><h1>Create API</h1><p>Design an endpoint definition with a guided builder. This preview stores nothing yet.</p></div></div>
      <div className="builder-steps"><span className="builder-step active">01 · Basic details</span><span className="builder-step">02 · Endpoint</span><span className="builder-step">03 · Inputs</span><span className="builder-step">04 · Response</span><span className="builder-step">05 · Test & Publish</span></div>
      <div className="builder-layout">
        <section className="panel">
          <div className="section-title section-title-first"><div><h2>Basic information</h2><p>Describe your API so developers understand it.</p></div></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="api-name">API name</label><input id="api-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Weather API" /></div>
            <div className="form-field"><label htmlFor="api-slug">Slug</label><input id="api-slug" value={slug} onChange={event => setSlug(event.target.value)} placeholder="weather-api" /></div>
            <div className="form-field"><label htmlFor="api-category">Category</label><select id="api-category" value={category} onChange={event => setCategory(event.target.value as ApiCategory)}>{(["AI", "Media", "Text", "Utilities", "Entertainment"] as const).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="form-field"><label htmlFor="api-method">HTTP Method</label><select id="api-method" value={method} onChange={event => setMethod(event.target.value as HttpMethod)}>{(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map(item => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="form-field full"><label htmlFor="api-description">Description</label><textarea id="api-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="What does this API do?" /></div>
            <div className="form-field full"><label htmlFor="api-endpoint">Endpoint path</label><input id="api-endpoint" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="/api/v1/your-route" /></div>
          </div>
          <div className="form-actions"><button className="primary-btn" onClick={showPreview}>Preview definition →</button></div>
          {preview && <div className="panel definition-preview"><div className="section-title section-title-first"><h2>Definition preview</h2></div><pre className="code-block">{JSON.stringify(preview, null, 2)}</pre><p className="note-text">Frontend preview only. Publishing and endpoint generation are not connected.</p></div>}
        </section>
        <aside className="panel builder-side">
          <div className="section-title section-title-first"><div><h2>Endpoint preview</h2><p>Route summary</p></div></div><div className="endpoint">{method} {endpoint}</div>
          <div className="muted-box side-note">Preview only. The future server will validate and save definitions, generate routes and publish endpoints securely.</div>
          <div className="section-title"><div><h2>Next steps</h2><p>Planned builder workflow</p></div></div>
          {["Configure parameters", "Define response schema", "Run test request", "Publish endpoint"].map(item => <div className="status-row" key={item}><span className="status-dot purple-dot" /><div className="status-meta">{item}</div></div>)}
        </aside>
      </div>
    </>
  );
}