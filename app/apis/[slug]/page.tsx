import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {BookOpen,FlaskConical} from "lucide-react";
import {apiCatalog,getApi} from "@/lib/api/catalog";
export function generateStaticParams(){return apiCatalog.map(api=>({slug:api.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;return {title:getApi(slug)?.name??"API"}}
export default async function ApiDetailPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const api=getApi(slug);if(!api)notFound();
 if(api.status!=="live")return <div className="source-page"><Link href="/apis" className="source-back">← كل الواجهات</Link><h1>{api.name}</h1><p>{api.description}</p><div className="source-notice">هذه الواجهة غير منشورة بعد، لذلك لن نعرض مسارًا تجريبيًا على أنه يعمل.</div></div>;
 const example=api.slug==="ai-chat"
  ? ['curl -X POST "$BASE_URL/api/v1/ai/gemini" \\', '  -H "Authorization: Bearer $NOX_API_KEY" \\', '  -H "Content-Type: application/json" \\', '  -d \' + JSON.stringify({prompt:"اشرح REST API"})].join("\n")
  : ['curl "$BASE_URL/api/v1/currency/rate?base=USD&target=EUR" \\', '  -H "Authorization: Bearer $NOX_API_KEY"'].join("\n");
 return <div className="source-page"><Link href="/apis" className="source-back">← كل الواجهات</Link><div className="source-page-head"><span className="source-overline">API REFERENCE / {api.method}</span><h1>{api.name}</h1><p>{api.description}</p></div><div className="source-endpoint"><b className={api.method.toLowerCase()}>{api.method}</b><code>{api.path}</code><span className="source-status live">متاحة فعليًا</span></div><section className="source-doc-card"><h2>مثال الاستدعاء</h2><pre dir="ltr"><code>{example}</code></pre><p>أرسل مفتاح API في ترويسة <code>Authorization: Bearer</code>. لا تضع المفتاح داخل كود الواجهة العامة.</p><div className="source-hero-actions"><Link href="/playground" className="source-button primary"><FlaskConical size={15}/> جرّب في Playground</Link><Link href="/docs" className="source-button"><BookOpen size={15}/> التوثيق</Link></div></section></div>;
}