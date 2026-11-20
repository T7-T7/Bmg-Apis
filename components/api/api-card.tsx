import Link from "next/link";
import {ArrowUpLeft,Bot,CircleDollarSign,Download,Image,MessageCircle,Languages} from "lucide-react";
import type {ApiDefinition} from "@/types/api";
import StatusLabel from "@/components/ui/status-label";
const icons={"ai-chat":Bot,"currency-rate":CircleDollarSign,"whatsapp-send":MessageCircle,"sticker-maker":Image,"downloader":Download,"translate":Languages};
export default function ApiCard({api}:{api:ApiDefinition}){
 const Icon=icons[api.slug as keyof typeof icons]??Bot;
 return <Link href={api.status==="live"?"/apis/"+api.slug:"/apis"} className={"source-api-card "+(api.status==="planned"?"planned":"")} aria-disabled={api.status!=="live"}>
  <div className="source-api-card-top"><span className="source-api-icon"><Icon size={19}/></span><StatusLabel live={api.status==="live"}/></div>
  <h3>{api.name}</h3><p>{api.description}</p><div className="source-api-meta"><span>{api.category}</span><code className={api.method.toLowerCase()}>{api.method}</code><span className="source-api-open">{api.status==="live"?"التفاصيل":"قريبًا"} <ArrowUpLeft size={13}/></span></div>
 </Link>;
}