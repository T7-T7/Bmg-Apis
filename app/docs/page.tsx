import Link from "next/link";

const guideCards = [
  { title: "Quick start", text: "Explore the catalog, inspect an endpoint and read the sample request.", href: "/apis" },
  { title: "API Builder", text: "Draft a definition, choose a route and HTTP method, and preview configuration.", href: "/create" },
  { title: "API lifecycle", text: "Draft, test, publish, version and manage APIs from your workspace.", href: "/my-apis" },
];

export default function DocsPage() {
  const requestExample = `// Example only — no live API is connected\nfetch("https://api.example.com/api/v1/echo?message=hello")\n  .then((res) => res.json())\n  .then((data) => console.log(data));`;
  const responseExample = { status: "preview", data: { message: "hello" }, requestId: "demo-request" };
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">DEVELOPER GUIDE</div><h1>Documentation</h1><p>Learn the platform concepts and how APIs will be integrated.</p></div></div>
      <div className="card-grid">{guideCards.map(card => <div className="panel docs-card" key={card.title}><h3>{card.title}</h3><p>{card.text}</p><Link href={card.href} className="mini-btn">Open section →</Link></div>)}</div>
      <div className="section-title"><div><h2>Request example</h2><p>Illustrative request pattern</p></div></div><pre className="code-block">{requestExample}</pre>
      <div className="section-title"><div><h2>Example response</h2><p>JSON</p></div></div><pre className="code-block">{JSON.stringify(responseExample, null, 2)}</pre>
    </>
  );
}