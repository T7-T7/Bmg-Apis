"use client";

import { useMemo, useState } from "react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories, type CatalogFilter } from "@/lib/api-data";

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogFilter>("All");
  const filtered = useMemo(() => apiCatalog.filter(api =>
    (category === "All" || api.category === category) &&
    `${api.name} ${api.description} ${api.category} ${api.endpoint}`.toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">API DIRECTORY</div><h1>Explore APIs</h1><p>Find services and explore their endpoints, usage and documentation.</p></div></div>
      <div className="search-bar"><div className="search-wrap"><span className="search-mark" aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search APIs, categories, endpoints…" aria-label="Search API catalog" /></div><button className="secondary-btn" onClick={() => { setQuery(""); setCategory("All"); }}>Reset</button></div>
      <div className="filters" aria-label="API categories">{categories.map(item => <button key={item} className={`filter-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div>
      <div className="section-title"><div><h2>{filtered.length} results</h2><p>Catalog · Preview data</p></div></div>
      <div className="card-grid">{filtered.map(api => <ApiCard key={api.slug} api={api} />)}{filtered.length === 0 && <div className="empty-state">No matching APIs found.</div>}</div>
    </>
  );
}