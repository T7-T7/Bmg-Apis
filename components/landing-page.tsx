import Link from "next/link";
import {Activity,ArrowLeft,ArrowUpLeft,BookOpen,Code2,KeyRound,ShieldCheck,Sparkles,Zap} from "lucide-react";
import DigitalGlobe from "@/components/globe/digital-globe";
import ApiCard from "@/components/api/api-card";
import {apiCatalog} from "@/lib/api/catalog";
export default function LandingPage(){
 const live=apiCatalog.filter(api=>api.status==="live");
 return <div className="source-home">
  <section className="source-hero"><div className="source-hero-copy">
   <div className="source-eyebrow"><Sparkles size={15}/> منصة مصرية للمطورين مفتوحة المصدر <i/></div>
   <h1>واجهات برمجية <span>جاهزة</span><br/>لبوتاتك ومشاريعك.</h1>
   <p className="source-lead">ذكاء اصطناعي، بيانات، وخدمات عملية — في منصة واحدة. مفاتيح API، توثيق واضح، وتجربة مباشرة للخدمات المنشورة.</p>
   <div className="source-hero-actions"><Link href="/playground" className="source-button primary"><Zap size={16}/> ابدأ في 5 دقائق</Link><Link href="/apis" className="source-button"><Code2 size={16}/> استكشف الواجهات</Link></div>
   <div className="source-hero-stats"><div><b>{live.length}</b><span>خدمات متاحة فعليًا</span></div><div><b>REST</b><span>واجهات موحدة</span></div><div><b>JSON</b><span>استجابات منظمة</span></div></div>
  </div><DigitalGlobe/></section>
  <div className="source-section-heading"><div><span className="source-overline">AVAILABLE SERVICES / 01</span><h2>الواجهات المتاحة</h2><p>الخدمات المنشورة التي يمكن استدعاؤها الآن.</p></div><Link href="/apis">عرض الكل <ArrowUpLeft size={15}/></Link></div>
  <div className="source-api-grid">{live.map(api=><ApiCard key={api.slug} api={api}/>)}</div>
  <div className="source-section-heading"><div><span className="source-overline">WHY BMG APIS / 02</span><h2>كل ما تحتاجه للبدء</h2><p>أدوات واضحة دون تعقيد إضافي.</p></div></div>
  <div className="source-feature-grid">
   <article><span><ShieldCheck size={20}/></span><h3>مصادقة آمنة</h3><p>مفاتيح API مرتبطة بحسابك، مع التحقق من الصلاحيات وحدود الطلبات على الخادم.</p></article>
   <article><span><Activity size={20}/></span><h3>حالة واضحة</h3><p>اعرض الخدمات المنشورة وحالة التطبيق بدل مؤشرات تشغيل تجريبية.</p></article>
   <article><span><BookOpen size={20}/></span><h3>توثيق مباشر</h3><p>أمثلة طلبات مطابقة لمسارات API الموجودة فعليًا.</p></article>
   <article><span><KeyRound size={20}/></span><h3>إدارة المفاتيح</h3><p>إنشاء المفاتيح وإلغاؤها من مساحة المطور مع عدم عرض السر إلا مرة واحدة.</p></article>
  </div>
  <section className="source-quickstart"><div><span className="source-overline">QUICK START / 03</span><h2>ابدأ التكامل الآن.</h2><p>أنشئ مفتاح Nox API، ثم استخدمه في ترويسة Authorization عند استدعاء الخدمة.</p></div><Link href="/dashboard/api-keys" className="source-button primary">إدارة مفاتيح API <ArrowLeft size={15}/></Link></section>
 </div>;
}