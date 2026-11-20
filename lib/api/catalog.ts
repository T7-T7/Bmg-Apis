import type {ApiDefinition} from "@/types/api";
export const apiCatalog:ApiDefinition[]=[
 {slug:"ai-chat",name:"AI Chat · Gemini",category:"ذكاء اصطناعي",description:"إنشاء ردود ذكية باستخدام Gemini مع دعم متابعة المحادثات.",method:"POST",path:"/api/v1/ai/gemini",status:"live",body:{prompt:"اشرح مفهوم REST API باختصار",instruction:"أجب باللغة العربية"}},
 {slug:"currency-rate",name:"Currency Rate",category:"بيانات",description:"الحصول على أسعار صرف مرجعية يومية من مصدر Frankfurter.",method:"GET",path:"/api/v1/currency/rate",status:"live",query:{base:"USD",target:"EUR"}},
 {slug:"whatsapp-send",name:"WhatsApp Send",category:"واتساب",description:"إرسال رسائل نصية وميديا عبر جلسات واتساب.",method:"POST",path:"/v1/whatsapp/send",status:"planned"},
 {slug:"sticker-maker",name:"Sticker Maker",category:"ميديا",description:"تحويل الصور إلى ملصقات WebP.",method:"POST",path:"/v1/media/sticker",status:"planned"},
 {slug:"downloader",name:"Media Downloader",category:"ميديا",description:"تنزيل الفيديو والصوت من الروابط المدعومة.",method:"GET",path:"/v1/download",status:"planned"},
 {slug:"translate",name:"Translate",category:"ذكاء اصطناعي",description:"ترجمة النصوص بين لغات متعددة.",method:"POST",path:"/v1/translate",status:"planned"}
];
export function getApi(slug:string){return apiCatalog.find(api=>api.slug===slug)}
