import Link from "next/link";
import { ArrowUpLeft, FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return <div className="panel not-found-panel"><span className="not-found-icon"><FileQuestion size={29} /></span><div className="eyebrow">خطأ 404 · الصفحة غير موجودة</div><h1>لم نعثر على هذه الصفحة</h1><p>قد يكون الرابط غير صحيح أو أن الصفحة نُقلت إلى مكان آخر.</p><Link className="primary-btn" href="/">العودة إلى لوحة التحكم <ArrowUpLeft size={14} /></Link></div>;
}