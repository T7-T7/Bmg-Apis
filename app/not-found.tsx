import Link from "next/link";
import { ArrowUpLeft, FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <section className="not-found-panel">
      <span><FileQuestion size={30} /></span>
      <div className="eyebrow">خطأ 404 / الصفحة غير موجودة</div>
      <h1>هذا المسار غير موجود</h1>
      <p>تأكد من عنوان الصفحة، أو ارجع إلى لوحة المنصة لمتابعة العمل.</p>
      <Link href="/" className="button-primary">العودة إلى الرئيسية <ArrowUpLeft size={15} /></Link>
    </section>
  );
}