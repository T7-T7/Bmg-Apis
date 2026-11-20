"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState,type ReactNode} from "react";
import {ArrowLeft,BookOpen,Command,Menu,Search,X} from "lucide-react";
import Sidebar from "@/components/navigation/sidebar";
export default function AppShell({children}:Readonly<{children:ReactNode}>){
 const pathname=usePathname();const [menu,setMenu]=useState(false);const [search,setSearch]=useState(false);
 const title=pathname==="/"?"الرئيسية":pathname.startsWith("/apis/")?"تفاصيل الواجهة":pathname==="/apis"?"الواجهات":pathname==="/docs"?"التوثيق":pathname==="/playground"?"Playground":pathname==="/status"?"حالة النظام":pathname==="/dashboard/api-keys"?"مفاتيح API":pathname==="/dashboard"?"لوحة المطور":pathname.startsWith("/settings")?"إعدادات الحساب":"Bmg-Apis";
 useEffect(()=>{setMenu(false);setSearch(false)},[pathname]);
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearch(v=>!v)}if(e.key==="Escape"){setSearch(false);setMenu(false)}};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn)},[]);
 if(pathname==="/login"||pathname==="/signup"||pathname==="/auth/callback")return <>{children}</>;
 return <div className="source-app">
  {menu&&<button className="source-scrim" aria-label="إغلاق القائمة" onClick={()=>setMenu(false)}/>}
  <Sidebar open={menu}/>
  <div className="source-main"><header className="source-header">
   <div className="source-header-left"><button className="source-menu" onClick={()=>setMenu(v=>!v)} aria-label="القائمة">{menu?<X size={19}/>:<Menu size={19}/>}</button><div className="source-crumb"><span>المنصة</span><ArrowLeft size={13}/><b>{title}</b></div></div>
   <div className="source-header-actions"><button className="source-search" onClick={()=>setSearch(true)}><Search size={15}/><span>بحث…</span><kbd><Command size={10}/> K</kbd></button><Link href="/docs" className="source-header-link"><BookOpen size={15}/> التوثيق</Link><Link href="/dashboard" className="source-header-cta">ابدأ الآن <ArrowLeft size={14}/></Link></div>
  </header><main className="source-content">{children}</main><footer className="source-footer"><span>© 2026 Bmg-Apis</span><span><i/> منصة مصرية للمطورين</span></footer></div>
  {search&&<div className="source-search-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSearch(false)}}><div className="source-search-dialog"><div className="source-search-field"><Search size={18}/><input autoFocus placeholder="ابحث عن صفحة أو خدمة…" onKeyDown={e=>{if(e.key==="Enter"){const q=e.currentTarget.value.toLowerCase();location.href=q.includes("توثيق")?"/docs":q.includes("مفتاح")?"/dashboard/api-keys":q.includes("play")?"/playground":q.includes("حالة")?"/status":"/apis"}}}/><kbd>ESC</kbd></div>{[["الرئيسية","/"],["الواجهات","/apis"],["التوثيق","/docs"],["Playground","/playground"],["لوحة المطور","/dashboard"],["مفاتيح API","/dashboard/api-keys"],["حالة النظام","/status"]].map(x=><Link href={x[1]} key={x[1]} onClick={()=>setSearch(false)}>{x[0]}<ArrowLeft size={13}/></Link>)}</div></div>}
 </div>;
}