import Link from "next/link";
import { ArrowUpLeft, FileCode2, Plus } from "lucide-react";

export default function MyApisPage() {
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">مساحة العمل</div><h1>واجهاتي</h1><p>تابع تعريفات واجهاتك التجريبية والمنشورة. تخزين البيانات غير متصل حاليًا.</p></div><Link href="/create" className="primary-btn"><Plus size={15} /> واجهة جديدة</Link></div>
      <div className="panel empty-state workspace-empty"><span className="empty-illustration"><FileCode2 size={30} /></span><strong className="empty-title">مساحة العمل فارغة حاليًا</strong><p>ستظهر الواجهات التي تنشئها هنا بعد تنفيذ نظام التخزين وربطه بالخادم.</p><Link href="/create" className="primary-btn empty-action">إنشاء أول واجهة <ArrowUpLeft size={14} /></Link></div>
    </>
  );
}