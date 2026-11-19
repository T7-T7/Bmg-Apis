import Link from "next/link";
import { ArrowUpLeft, Braces, Code2, ExternalLink } from "lucide-react";
import type { ApiDefinition } from "@/lib/api-data";

export default function ApiCard({ api }: { api: ApiDefinition }) {
  return (
    <article className="api-card">
      <div className="api-card-head">
        <div className="api-symbol"><Braces size={19} strokeWidth={1.8} /></div>
        <div className="api-card-title"><div className="api-name">{api.name}</div><div className="api-category">{api.category}</div></div>
        <span className="preview-tag">تجريبية</span>
      </div>
      <p className="api-description">{api.description}</p>
      <div className="endpoint" dir="ltr">{api.endpoint}</div>
      <div className="api-footer">
        <span className={`method method-${api.method.toLowerCase()}`}>{api.method}</span>
        <div className="api-links">
          <Link className="mini-btn" href={`/apis/${api.slug}`}>التفاصيل <ArrowUpLeft size={12} /></Link>
          <Link className="mini-btn" href="/docs">التوثيق <ExternalLink size={11} /></Link>
        </div>
      </div>
    </article>
  );
}