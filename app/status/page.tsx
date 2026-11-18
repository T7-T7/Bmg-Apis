type ServiceStatus = { name: string; description: string; state: "UI Ready" | "Not connected" };

const services: ServiceStatus[] = [
  { name: "API Catalog UI", description: "Search, filters and API cards", state: "UI Ready" },
  { name: "API Builder UI", description: "Definition editor preview", state: "UI Ready" },
  { name: "Documentation UI", description: "Docs page layouts", state: "UI Ready" },
  { name: "API Runtime", description: "Public endpoint execution", state: "Not connected" },
];

const plannedMonitoring = ["Live uptime checks", "Latency measurements", "Request volume tracking"];

export default function StatusPage() {
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">SYSTEM HEALTH</div><h1>Service Status</h1><p>Frontend interface status only. No live uptime or API checks are running.</p></div></div>
      <div className="panel status-summary"><div className="status-summary-title"><span className="status-dot amber-dot" /><strong>Frontend preview available</strong></div><p>No backend runtime, uptime checks, or request analytics are connected.</p></div>
      <div className="panel">{services.map(service => <div className="status-row" key={service.name}><span className={`status-dot ${service.state === "UI Ready" ? "purple-dot" : "amber-dot"}`} /><div><div className="status-meta">{service.name}</div><div className="status-sub">{service.description}</div></div><div className={`status-result ${service.state === "UI Ready" ? "purple-text" : "amber-text"}`}>{service.state}</div></div>)}</div>
      <div className="section-title"><div><h2>Monitoring roadmap</h2><p>Planned for backend phase</p></div></div><div className="card-grid">{plannedMonitoring.map(item => <div className="panel monitoring-card" key={item}><div>{item}</div><p>Not connected in this frontend-only stage.</p></div>)}</div>
    </>
  );
}