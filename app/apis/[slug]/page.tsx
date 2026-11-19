import Link from "next/link";
import { notFound } from "next/navigation";
import { Braces, ChevronRight } from "lucide-react";
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
  const jsExample = `fetch("https://your-domain.example${api.endpoint}")
  .then(response => response.json())
  .then(data => console.log(data));`;

  return (
    <>
      <div className="page-heading detail-heading"><div><div className="eyebrow">تفاصيل الواجهة <ChevronRight size={12} /> {api.category}</div><h1>{api.name}</h1><p>{api.description}</p></div><Link className="secondary-btn" href="/apis">العودة إلى الكتالوج <ArrowUpRight size={14} /></Link></div>
      <div className="panel api-detail-panel"><div className="api-card-head"><div className="api-symbol"><Braces size={20} /></div><div><div className="api-name">{api.name}</div><div className="api-category">{api.category} · نسخة تجريبية</div></div><span className="preview-tag">تجريبية</span></div><div className="endpoint" dir="ltr">{api.endpoint}</div><div className="method-wrap"><span className={`method method-${api.method.toLowerCase()}`}>{api.method}</span></div></div>
      <div className="section-title"><div><h2>نقطة الاتصال</h2><p>مسار توضيحي · غير متصل بالخادم بعد</p></div></div><div className="panel"><div className="endpoint" dir="ltr">{api.endpoint}</div><p className="note-text">سيتم إعداد المصادقة والمعاملات والتنفيذ الفعلي خلال مرحلة تطوير الخادم الخلفي.</p></div>
      <div className="section-title"><div><h2>مثال على الاستجابة</h2><p>معاينة توضيحية بصيغة JSON</p></div></div><pre className="code-block" dir="ltr">{JSON.stringify(exampleResponse, null, 2)}</pre>
      <div className="section-title"><div><h2>مثال برمجي باستخدام JavaScript</h2><p>نموذج طلب من تطبيق خارجي</p></div></div><pre className="code-block">{jsExample}</pre>
    </>
  );
}