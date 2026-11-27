# NEXUS OF XPERIENCE (Nox)

**Nox** is the developer API platform owned by **Bmg, Inc.**

© 2026 Bmg, Inc.

منصة مطورين لإدارة مفاتيح API، استكشاف الخدمات المنشورة، اختبار الطلبات، ومراجعة استخدام الواجهات من لوحة واحدة.

## الحالة الحالية

- **الاسم الرسمي:** NEXUS OF XPERIENCE
- **الاختصار:** Nox
- **الواجهة:** Next.js App Router + React + TypeScript.
- **المصادقة وإدارة المفاتيح:** Supabase Auth وRPCs الموجودة في قاعدة البيانات.
- **النشر:** Vercel — فرع الإنتاج `main`.
- **التصميم:** واجهة عربية RTL، وضع داكن، متجاوبة مع الهاتف وسطح المكتب.
- **لا يتم تعديل مخطط Supabase أو سياسات RLS عند تشغيل الواجهة.**

## الخدمات النشطة

| الخدمة | الطريقة | المسار | المصدر |
|---|---|---|---|
| عقل — Gemini | POST | `/api/v1/ai/gemini` | Gemini |
| GPTFree | POST | `/api/v1/ai/gptfree` | GPTFree |
| ChatGPT | POST | `/api/v1/ai/chatgpt` | ChatGPT Web (unofficial) |
| Star X | POST | `/api/v1/ai/star-x` | PhotoRoom AI tools |

لا تعرض الواجهة خدمات مستقبلية على أنها متاحة. أي خدمة غير موجودة في قائمة الخدمات النشطة لا تعد جزءاً من واجهات الإنتاج.

## البنية الهندسية

يعتمد المشروع نهج **Modular Monolith**: تطبيق Next.js واحد، وحدود وحدات واضحة، ومحرك تنفيذ مركزي للخدمات. يحتفظ كل API route بعقده العام، بينما يتولى Nox Core دورة التنفيذ المشتركة ومعرّف الطلب وترويسات التتبع ومعالجة الفشل. تبقى المصادقة والتفويض والتحقق وتتبع الاستخدام داخل وحداتها الحالية أثناء ترحيلها تدريجيًا إلى مديري Core مستقلين.

لا يتم تحميل كود قابل للتنفيذ من قاعدة البيانات؛ سجل الخدمات في المصدر هو manifest ثابت، وتظل Supabase مرجعًا لحالة الخدمة والصلاحيات والحصص.

## صفحات المنصة

| المسار | الوظيفة |
|---|---|
| `/` | الصفحة الرئيسية |
| `/playground` | تجربة النماذج وإرسال المطالبات ومقارنة الاستجابات |
| `/dashboard` | لوحة التحكم والإحصائيات والرسوم والنشاط |
| `/dashboard/api-keys` | إدارة مفاتيح API |
| `/dashboard/settings` | إعدادات الحساب |
| `/dashboard/admin` | إدارة المنصة |
| `/models` و`/models/[slug]` | كتالوج النماذج |
| `/docs` و`/reference` | توثيق ومرجع API |
| `/status` | حالة المنصة والخدمات |
| `/support` | الدعم |
| `/login` | تسجيل الدخول |

## المتطلبات والتشغيل

- Node.js `>=20.9.0 <27`.
- npm.
- مشروع Supabase مرتبط.

```bash
npm install
npm run dev
```

## متغيرات البيئة

تُضبط القيم في Vercel Project Settings ولا تحفظ داخل Git:

| المتغير | الاستخدام |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح Supabase العام |
| `GEMINI_SESSION_SECRET` | سر خادمي لتشفير جلسات Gemini |
| `BMG_DEMO_RPC_SECRET` | السر الخادمي المطابق لإعداد RPC |
| `GEMINI_TIMEOUT_MS` | مهلة Gemini؛ اختياري |
| `CHATGPT_SESSION_SECRET` | سر خادمي لتشفير جلسات ChatGPT؛ يمكن استخدام `GEMINI_SESSION_SECRET` بدلًا منه |

لا تستخدم `service_role` أو أي سر خادمي في متغير يبدأ بـ `NEXT_PUBLIC_`.

## فحوصات الجودة

```bash
npm run test:security
npm run typecheck
npm run lint
npm run build
```

## موارد المطورين

- فحص الصحة: `/api/health`
- الجاهزية: `/api/ready`
- مواصفات OpenAPI: `/api/openapi.json`
- توثيق Markdown: `/docs.md`
- فهرس LLM: `/llms.txt`

## النشر

المستودع مرتبط بفرع `main`. يجب أن يستهدف نشر الإنتاج بيئة Vercel المسماة **Production**. بعد النشر، اختبر الصفحات والمصادقة ومفاتيح API والخدمات النشطة.

---

**NEXUS OF XPERIENCE · Nox**  
© 2026 Bmg, Inc.
