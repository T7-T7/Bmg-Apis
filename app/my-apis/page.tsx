import Link from "next/link";
import { ArrowUpLeft, Clock3, FileCode2, ShieldCheck } from "lucide-react";

export default function MyApisPage() {
  return (
    <div>
      <div className="page-heading"><div><div className="eyebrow">مساحة المطور / سجل المساهمات</div><h1>مساهماتي</h1><p>تابع الواجهات التي اقترحتها وحالة مراجعتها واعتمادها.</p></div><Link href="/create" className="button-primary"><FileCode2 size={15} /> اقتراح API</Link></div>
      <div className="workspace-empty">
        <span className="workspace-empty-icon"><Clock3 size={27} /></span>
        <h2>سجل المساهمات سيظهر هنا</h2>
        <p>نظام الحسابات وحفظ الطلبات لم يُربط بعد. عند تفعيله ستتمكن من متابعة حالة كل مساهمة وملاحظات المشرف ونتائج الفحص.</p>
        <Link href="/create" className="button-primary">إرسال اقتراح جديد <ArrowUpLeft size={15} /></Link>
      </div>
      <div className="docs-note"><ShieldCheck size={14} /> كل مساهمة تمر بمراجعة بشرية، ثم اختبار تقني، قبل ظهورها في الكتالوج العام.</div>
    </div>
  );
}