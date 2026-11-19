"use client";

import { useMemo, useState } from "react";
import { Boxes, Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import ApiCard from "@/components/api-card";
import { apiCatalog, categories, type CatalogFilter } from "@/lib/api-data";

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogFilter>("الكل");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return apiCatalog.filter(api => {
      const matchesCategory = category === "الكل" || api.category === category;
      const searchable = [api.name, api.description, api.category, api.endpoint, api.method].join(" ").toLocaleLowerCase("ar");
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [query, category]);

  const hasFilters = query.length > 0 || category !== "الكل";

  return (
    <div className="catalog-page">
      <div className="page-heading">
        <div><div className="eyebrow">مكتبة المنصة / استكشف</div><h1>كتالوج الواجهات</h1><p>اكتشف النماذج المتاحة، وتعرّف على مساراتها وطرق الطلب قبل دمجها في مشروعك.</p></div>
      </div>
      <div className="catalog-toolbar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث عن واجهة، تصنيف، أو مسار..." aria-label="البحث في الواجهات" />{query && <button type="button" className="clear-search" onClick={() => setQuery("")} aria-label="مسح البحث"><X size={14} /></button>}</label>
        <button type="button" className="catalog-reset" onClick={() => { setQuery(""); setCategory("الكل"); }} disabled={!hasFilters}><RotateCcw size={14} /><span>إعادة ضبط</span></button>
      </div>
      <div className="filter-toolbar"><SlidersHorizontal size={14} /><span>تصفية حسب المجال</span></div>
      <div className="filter-list" role="group" aria-label="تصنيفات الواجهات">
        {categories.map(item => <button key={item} type="button" className={`filter-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
      </div>
      <div className="catalog-meta"><strong>{filtered.length} واجهات</strong><span>{hasFilters ? "نتائج مطابقة لعوامل البحث" : "جميع النماذج في الكتالوج"}</span></div>
      {filtered.length > 0 ? <div className="api-grid">{filtered.map(api => <ApiCard api={api} key={api.slug} />)}</div> : (
        <div className="empty-state"><Boxes size={27} /><strong>لم نعثر على نتائج</strong><p>جرّب كلمة بحث مختلفة أو أزل بعض عوامل التصفية للوصول إلى الواجهات.</p><button className="button-secondary" onClick={() => { setQuery(""); setCategory("الكل"); }}>عرض كل الواجهات</button></div>
      )}
    </div>
  );
}