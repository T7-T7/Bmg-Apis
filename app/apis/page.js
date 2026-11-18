"use client";
import { useMemo, useState } from "react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories } from "@/lib/api-data";
export default function CatalogPage(){
 const [query,setQuery]=useState("");const [category,setCategory]=useState("All");
 const filtered=useMemo(()=>apiCatalog.filter(api=>(category==="All"||api.category===category)&&(`${api.name} ${api.description} ${api.category} ${api.endpoint}`).toLowerCase().includes(query.toLowerCase())),[query,category]);
 return <>
  <div className="page-heading"><div><div className="eyebrow">API DIRECTORY</div><h1>Explore APIs</h1><p>Find services and explore their endpoints, usage and documentation.</p></div></div>
  <div className="search-bar"><div className="search-wrap"><span className="search-mark">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search APIs, categories, endpoints…"/></div><button className="secondary-btn" onClick={()=>{setQuery("");setCategory("All")}}>Reset</button></div>
  <div className="filters">{categories.map(c=><button key={c} className={`filter-chip ${category===c?"active":""}`} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <div className="section-title"><div><h2>{filtered.length} results</h2><p>Catalog · Preview data</p></div></div>
  <div className="card-grid">{filtered.map(api=><ApiCard key={api.slug} api={api}/>)}{!filtered.length&&<div className="empty-state">No matching APIs found.</div>}</div>
 </>;
}