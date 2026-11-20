# BMG APIs

منصة عربية للمطورين لاستكشاف واجهات API واختبارها وإدارة مفاتيح الوصول، مبنية باستخدام Next.js وSupabase ومنشورة عبر Vercel.

## نظرة عامة

يوفر المشروع واجهة موحدة للوصول إلى خدمات API، مع تجربة تفاعلية من المتصفح، ومصادقة المستخدمين، وإدارة مفاتيح الوصول، ولوحة تعرض تحليلات الاستخدام الخاصة بالحساب.

### التقنيات

- **Next.js 16** — App Router وRoute Handlers.
- **React 19** — واجهة تفاعلية.
- **TypeScript** — فحص الأنواع مع Strict Mode.
- **Supabase** — PostgreSQL وAuth وRPC.
- **Vercel** — النشر وتشغيل مسارات API.
- **Frankfurter** — مصدر أسعار الصرف المرجعية اليومية.

## شجرة المشروع

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts
│   │   ├── openapi.json/
│   │   │   └── route.ts
│   │   └── v1/
│   │       ├── ai/
│   │       │   └── gemini/
│   │       │       └── route.ts
│   │       └── currency/
│   │           └── rate/
│   │               └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── bmg-platform.tsx
├── lib/
│   ├── api/
│   │   └── catalog.ts
│   ├── server/
│   │   └── gemini.ts
│   ├── services/
│   │   └── health.ts
│   └── supabase/
│       └── client.ts
├── supabase/
│   └── migrations/
│       ├── 20261120010000_harden_profile_and_api_authorization.sql
│       ├── 20261120055443_rename_api_key_prefix_to_nox_live.sql
│       ├── 20261120070000_public_demo_access.sql
│       ├── 20261120071000_secure_public_demo_rpc.sql
│       └── 20261120183000_add_private_api_usage_analytics.sql
├── types/
│   └── api.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

> ملاحظة: شجرة الملفات أعلاه تعكس الملفات التي تمت مراجعتها في فرع `main`، وتضيف ملفات واجهة المستخدم الجديدة في هذا التحديث.

## الواجهات المنشورة فعلياً

الخدمات التالية هي المسارات التشغيلية التي يتضمنها الخادم حالياً. عناصر الكتالوج المستقبلية لا تُعرض كواجهات جاهزة للاستخدام.

| الخدمة | الطريقة | المسار | الحالة |
|---|---|---|---|
| عقل — Gemini | POST | `/api/v1/ai/gemini` | متاحة |
| أسعار العملات | GET | `/api/v1/currency/rate` | متاحة |

### 1. Gemini

**POST** `/api/v1/ai/gemini`

الترويسات:

```http
Content-Type: application/json
Authorization: Bearer nox_live_YOUR_API_KEY
```

الجسم:

```json
{
  "prompt": "اشرح مفهوم REST API باختصار",
  "instruction": "أجب باللغة العربية"
}
```

يدعم المسار `sessionId` لمتابعة المحادثة، ويقبل نصاً حتى 30,000 حرف. حد المفتاح الموثق هو 30 طلباً في الدقيقة. تتوفر تجربة عامة محدودة دون مفتاح وفق سياسة الخادم.

### 2. أسعار العملات

**GET** `/api/v1/currency/rate?base=USD&target=EUR`

الترويسات الاختيارية:

```http
Authorization: Bearer nox_live_YOUR_API_KEY
```

الاستجابة تتضمن العملتين والسعر وتاريخ السعر ومصدره. الأسعار مرجعية يومية وليست أسعار تداول لحظية.

## الواجهة الأمامية

تتضمن الواجهة:

- صفحة رئيسية تعريفية.
- كتالوج API مع البحث والتصفية.
- Playground لتنفيذ طلبات حقيقية إلى المسارات المنشورة.
- توثيق تقني وأمثلة JavaScript.
- تسجيل الدخول بالبريد وكلمة المرور وGoogle OAuth.
- لوحة تحكم بإحصائيات الاستخدام المسجلة للمستخدم.
- إنشاء مفاتيح API وإلغاؤها.
- صفحة حالة الخدمات.

تقرأ الواجهة الخدمات من جدول `public.api_services`، وتستخدم إجراءات Supabase الحالية لإدارة المفاتيح والتحليلات. لا تعرض الواجهة قيماً تجريبية على أنها بيانات حساب فعلية.

## إعداد متغيرات البيئة

أضف القيم في إعدادات المشروع على Vercel، وفي ملف `.env.local` للتطوير المحلي:

| المتغير | الاستخدام |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام القابل للنشر (Anon/Publishable) |
| `GEMINI_SESSION_SECRET` | سر تشفير جلسات Gemini، بطول 32 حرفاً على الأقل |
| `BMG_DEMO_RPC_SECRET` | السر الداخلي للتحقق من طلبات التجربة العامة |
| متغيرات مزود Gemini الأخرى | حسب إعدادات خدمة Gemini الحالية في الخادم |

لا تضع مفاتيح الخدمة السرية أو أسرار الخادم في متغيرات تبدأ بـ `NEXT_PUBLIC_`، ولا ترفع ملف البيئة إلى Git.

## التشغيل المحلي

يتطلب Node.js 20.9 أو أحدث، ثم:

```bash
npm install
npm run dev
```

افتح `http://localhost:3000`.

## فحوصات الجودة

```bash
npm run typecheck
npm run lint
npm run build
```

## نقاط الاتصال المساعدة

- `GET /api/health` — فحص صحة التطبيق.
- `GET /api/openapi.json` — مواصفة OpenAPI 3.1 للمسارات المنشورة.

## المصادقة والأمان

- تتم المصادقة عبر Supabase Auth.
- تُنشأ مفاتيح الوصول بواسطة RPC `bmg_create_api_key`.
- تُخزن بصمة المفتاح في قاعدة البيانات ولا يُخزن النص الأصلي للمفتاح.
- تظهر قيمة المفتاح كاملة مرة واحدة عند إنشائه.
- يمكن سرد المفاتيح وإلغاؤها عبر RPCs الحالية.
- تحمي سياسات RLS وعمليات RPC بيانات المستخدمين.
- يجب عدم وضع مفاتيح API السرية في كود المتصفح أو المستودع.

## النشر

المستودع مرتبط بمشروع Vercel، والفرع الأساسي الموثق في إعدادات المشروع هو `main`. يجب ضبط متغيرات البيئة وإعداد Google OAuth في Supabase قبل إتاحة جميع وظائف الحسابات على نطاق الإنتاج.

---

**BMG APIs** — أدوات برمجية عملية، وتجربة واضحة للمطورين.
