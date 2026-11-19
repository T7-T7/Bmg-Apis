import Link from "next/link";
import { Braces, ChevronLeft } from "lucide-react";
import type { ApiDefinition } from "@/lib/api-data";

const methodLabels: Record<ApiDefinition["method"], string> = {
  GET: "قراءة",
  POST: "إنشاء",
  PUT: "تحديث",
  PATCH: "تعديل",
  DELETE: "حذف",
};

export default function ApiCard({ api }: { api: ApiDefinition }) {
  return (
    <article className="api-card">
      <div className="api-card-top">
        <div className="api-glyph"><Braces size={20} strokeWidth={1.7} /></div>
        <span className="api-state"><i /> نموذج أولي</span>
        <span className="card-more" aria-hidden="true">•••</span>
      </div>
      <div className="api-card-title">
        <div><h3>{api.name}</h3><span>{api.category}</span></div>
      </div>
      <p className="api-description">{api.description}</p>
      <div className="api-route">
        <span className={`method method-${api.method.toLowerCase()}`}>{api.method}</span>
        <code dir="ltr">{api.endpoint}</code>
        <span className="route-copy"><Copy size={13} /></span>
      </div>
      <div className="api-card-bottom">
        <span className="method-caption">{methodLabels[api.method]} · REST API</span>
        <Link href={`/apis/${api.slug}`} className="card-link">عرض التفاصيل <ChevronLeft size={14} /></Link>
      </div>
    </article>
  );
}