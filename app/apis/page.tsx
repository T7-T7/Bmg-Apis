import type {Metadata} from "next";
import ApiCard from "@/components/api/api-card";
import {apiCatalog} from "@/lib/api/catalog";
export const metadata:Metadata={title:"الواجهات"};
export default function ApisPage(){
 const available=apiCatalog.filter(x=>x.status==="live"),planned=apiCatalog.filter(x=>x.status==="planned");
 return <div className="source-page"><div className="source-page-head"><span className="source-overline">API CATALOG / 01</span><h1>الواجهات المفتوحة</h1><p>استعرض الخدمات الحقيقية المنشورة، وتعرّف على الواجهات المخطط إضافتها.</p></div>
 <h2 className="source-subhead">متاحة الآن <span>{available.length}</span></h2><div className="source-api-grid">{available.map(api=><ApiCard key={api.slug} api={api}/>)}</div>
 <h2 className="source-subhead">قيد التطوير <span>{planned.length}</span></h2><div className="source-api-grid">{planned.map(api=><ApiCard key={api.slug} api={api}/>)}</div></div>;
}