import Link from "next/link";
import { ArrowUpLeft, Code2, FolderPlus } from "lucide-react";

export default function MyApisPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مساحة المطور / إدارة المشاريع</div><h1>واجهاتي</h1><p>مكان واحد لمتابعة تعريفات واجهاتك وإصداراتها وحالة نشرها.</p></div><Link href="/create" className="button-primary"><FolderPlus size={15} /> واجهة جديدة</Link></div>
      <div className="workspace-empty">
        <span className="workspace-empty-icon"><Code2 size={27} /></span>
        <h2>مساحة العمل جاهزة لمشروعك الأول</h2>
        <p>لم تُنشأ واجهات بعد. ابدأ بإنشاء تعريف جديد، وستظهر هنا بعد تفعيل نظام الحفظ وربطه بحسابك.</p>
        <Link href="/create" className="button-primary">إنشاء أول واجهة <ArrowUpLeft size={15} /></Link>
      </div>
    </div>
  );
}