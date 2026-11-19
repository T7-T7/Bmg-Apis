import Link from "next/link";
import { ArrowUpLeft, BookOpen, Braces, Code2, FileCode2, Layers3 } from "lucide-react";

const guideCards = [
  { title: "البداية السريعة", text: "تصفّح الكتالوج، وافتح تفاصيل الواجهة، واطّلع على مثال الطلب.", href: "/apis", icon: Code2 },
  { title: "منشئ الواجهات", text: "أنشئ تعريفًا أوليًا وحدّد المسار وطريقة الطلب ثم عاين الإعدادات.", href: "/create", icon: Braces },
  { title: "دورة حياة الواجهة", text: "تعرّف على مراحل إعداد الواجهات واختبارها ونشرها وإدارتها.", href: "/my-apis", icon: Layers3 },
];

export default function DocsPage() {
  const requestExample = `// مثال توضيحي فقط — لا توجد واجهة API فعلية متصلة
fetch("https://api.example.com/api/v1/echo?message=hello")
  .then((res) => res.json())
  .then((data) => console.log(data));`;
  const responseExample = { status: "preview", data: { message: "hello" }, requestId: "demo-request" };
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">دليل المطور</div><h1>التوثيق</h1><p>تعرّف على مكونات المنصة وطريقة استكشاف الواجهات ودمجها في مشاريعك.</p></div><span className="docs-heading-icon"><BookOpen size={21} /></span></div>
      <div className="card-grid">{guideCards.map(card => {
        const Icon = card.icon;
        return <div className="panel docs-card" key={card.title}><span className="docs-icon"><Icon size={19} /></span><h3>{card.title}</h3><p>{card.text}</p><Link href={card.href} className="mini-btn">فتح القسم <ArrowUpLeft size={12} /></Link></div>;
      })}</div>
      <div className="section-title"><div><h2>مثال على إرسال طلب</h2><p>نموذج توضيحي باستخدام JavaScript</p></div></div><pre className="code-block">{requestExample}</pre>
      <div className="section-title"><div><h2>مثال على الاستجابة</h2><p>بيانات JSON توضيحية</p></div></div><pre className="code-block" dir="ltr">{JSON.stringify(responseExample, null, 2)}</pre>
      <p className="note-text">الأمثلة الواردة في هذه الصفحة للتوضيح فقط، ولا تشير إلى وجود خادم API فعلي متصل حاليًا.</p>
    </>
  );
}