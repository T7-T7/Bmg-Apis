import type {Metadata} from "next";
import DashboardLinks from "@/components/dashboard/dashboard-links";
export const metadata:Metadata={title:"لوحة المطور"};
export default function DashboardPage(){return <div className="source-page"><div className="source-page-head"><span className="source-overline">DEVELOPER WORKSPACE / 01</span><h1>لوحة المطور</h1><p>إدارة الوصول إلى الخدمات والانتقال إلى أدوات التكامل.</p></div><DashboardLinks/><div className="source-notice">الإحصائيات التفصيلية ستظهر عند توفر سجل استخدام فعلي موحد للخدمات؛ لن نعرض أرقامًا ثابتة على أنها استخدام حقيقي.</div></div>}