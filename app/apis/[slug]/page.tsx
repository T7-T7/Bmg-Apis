import Link from "next/link";
import { notFound } from "next/navigation";
import { apiCatalog } from "@/lib/api-data";

type DetailProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return apiCatalog.map(api => ({ slug: api.slug }));
}

export default async function ApiDetailPage({ params }: DetailProps) {
  const { slug } = await params;
  const api = apiCatalog.find(item => item.slug === slug);
  if (!api) notFound();

  const exampleResponse = { status: "preview", data: { example: "Sample response data" }, note: "Illustrative only — not a live API" };
  const jsExample = `fetch("https://your-domain.example${api.endpoint}")\n  .then(response => response.json())\n  .then(data => console.log(data));`;

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">API DETAILS / {api.category.toUpperCase()}</div><h1>{api.name}</h1><p>{api.description}</p></div><Link className="secondary-btn" href="/apis">← Catalog</Link></div>
      <div className="panel api-detail-panel"><div className="api-card-head"><div className="api-symbol">{api.symbol}</div><div><div className="api-name">{api.name}</div><div className="api-category">{api.category} · Preview</div></div></div><div className="endpoint">{api.endpoint}</div><div className="method-wrap"><span className="method">{api.method}</span></div></div>
      <div className="section-title"><div><h2>Endpoint</h2><p>Example route · Not connected yet</p></div></div><div className="panel"><div className="endpoint">{api.endpoint}</div><p className="note-text">Authentication, parameters and live execution will be configured during the backend phase.</p></div>
      <div className="section-title"><div><h2>Example response</h2><p>Illustrative JSON preview</p></div></div><pre className="code-block">{JSON.stringify(exampleResponse, null, 2)}</pre>
      <div className="section-title"><div><h2>JavaScript example</h2><p>Sample client request</p></div></div><pre className="code-block">{jsExample}</pre>
    </>
  );
}