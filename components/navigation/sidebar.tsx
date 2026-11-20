"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Activity,BookOpen,Boxes,FlaskConical,Home,KeyRound,ShieldCheck} from "lucide-react";
const groups=[
 {title:"المنصة",links:[{href:"/",label:"الرئيسية",icon:Home},{href:"/apis",label:"الواجهات",icon:Boxes},{href:"/status",label:"حالة النظام",icon:Activity}]},
 {title:"المطورين",links:[{href:"/docs",label:"التوثيق",icon:BookOpen},{href:"/playground",label:"Playground",icon:FlaskConical},{href:"/dashboard",label:"لوحة المطور",icon:ShieldCheck},{href:"/dashboard/api-keys",label:"مفاتيح API",icon:KeyRound}]}
];
export default function Sidebar({open}:{open:boolean}){
 const pathname=usePathname();
 return <aside className={"source-sidebar "+(open?"is-open":"")}>
  <Link href="/" className="source-brand"><span className="source-brand-mark">B</span><span><b>Bmg-Apis</b><small>Nexus Of Xperience</small></span></Link>
  <div className="source-workspace"><span className="source-avatar">B</span><span><b>Bmg-Apis</b><small>منصة المطورين</small></span></div>
  <nav>{groups.map(group=><section key={group.title}><h2>{group.title}</h2>{group.links.map(item=>{const Icon=item.icon;const active=item.href==="/" ? pathname==="/" : pathname===item.href||(item.href==="/apis"&&pathname.startsWith("/apis/"));return <Link key={item.href} href={item.href} className={"source-nav-link "+(active?"active":"")}><Icon size={17}/><span>{item.label}</span>{active&&<i/>}</Link>})}</section>)}</nav>
  <div className="source-sidebar-foot"><ShieldCheck size={17}/><div><b>منصة للمطورين</b><small>من مصر إلى العالم</small></div></div>
 </aside>;
}