"use client";

import { useMemo, useState } from "react";
import { Search, RotateCcw, SlidersHorizontal, Boxes } from "lucide-react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories, type CatalogFilter } from "@/lib/api-data";

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogFilter>("الكل");
  const filtered = useMemo(() => apiCatalog.filter(api =>
    (category === "الكل" || api.category === category) &&
    `${api.name} ${api.description} ${api.category} ${api.endpoint}`.toLowerCase().includes(query.toLowerCase())
  ), [query, category]);

  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">دليل الواجهات</div><h1>استكشاف واجهات API</h1><p>ابحث عن الواجهات المتاحة وتعرّف على نقاط الاتصال وطرق الاستخدام والتوثيق.</p></div></div>
      <div className="search-bar">
        <div className="search-wrap"><Search className="search-mark" size={17} aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم الواجهة أو التصنيف أو المسار..." aria-label="البحث في كتالوج الواجهات" /><kbd className="search-shortcut">بحث</kbd></div>
        <button className="secondary-btn reset-btn" onClick={() => { setQuery(""); setCategory("الكل"); }}><RotateCcw size={14} /> إعادة ضبط</button>
      </div>
      <div className="filter-heading"><SlidersHorizontal size={14} /><span>تصفية حسب التصنيف</span></div>
      <div className="filters" aria-label="تصنيفات الواجهات">{categories.map(item => <button key={item} className={`filter-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}</div>
      <div className="section-title"><div><h2>{filtered.length} واجهات</h2><p>نتائج الكتالوج · بيانات تجريبية</p></div></div>
      <div className="card-grid">{filtered.map(api => <ApiCard key={api.slug} api={api} />)}{filtered.length === 0 && <div className="panel empty-state"><Boxes size={26} /><strong className="empty-title">لا توجد نتائج مطابقة</strong><p>جرّب تغيير كلمات البحث أو اختيار تصنيف آخر.</p><button className="secondary-btn empty-action" onClick={() => { setQuery(""); setCategory("الكل"); }}>مسح عوامل التصفية</button></div>}</div>
    </>
  );
}