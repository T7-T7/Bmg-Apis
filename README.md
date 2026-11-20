# BMG APIs

منصة عربية للمطورين لاستكشاف واجهات API واختبارها وإدارة مفاتيح الوصول، مبنية باستخدام Next.js 16 وReact 19 وTypeScript وSupabase، ومنشورة عبر Vercel.

## شجرة المشروع

```text
.
├── .github/workflows/ci.yml
├── app/
│   ├── api/
│   │   ├── health/route.ts
│   │   ├── openapi.json/route.ts
│   │   └── v1/
│   │       ├── ai/gemini/route.ts
│   │       └── currency/rate/route.ts
│   ├── docs.md/route.ts
│   ├── llms.txt/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/bmg-platform.tsx
├── lib/
│   ├── api/catalog.ts
│   ├── server/gemini.ts
│   ├── services/health.ts
│   └── supabase/client.ts
├── supabase/migrations/
│   ├── 20261120010000_harden_profile_and_api_authorization.sql
│   ├── 20261120055443_rename_api_key_prefix_to_nox_live.sql
│   ├── 20261120070000_public_demo_access.sql
│   ├── 20261120071000_secure_public_demo_rpc.sql
│   └── 20261120183000_add_private_api_usage_analytics.sql
├── types/api.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

> الشجرة تشمل الملفات التي تمت مراجعتها في فرع main وملفات الواجهة المضافة في فرع التطوير.

## الواجهات المنشورة فعلياً

| الخدمة | الطريقة | المسار | الحالة |
|---|---|---|---|
| عقل — Gemini | POST | `/api/v1/ai/gemini` | متاحة |
| أسعار العملات | GET | `/api/v1/currency/rate` | متاحة |

### Gemini

**POST** `/api/v1/ai/gemini`

```http
Content-Type: application/json
Authorization: Bearer nox_live_YOUR_API_KEY
```

```json
{
  "prompt": "اشرح مفهوم REST API باختصار",
  "instruction": "أجب باللغة العربية"
}
```

يدعم `sessionId` لمتابعة المحادثة. الحد الأقصى للنص 30,000 حرف، وحد المفتاح الموثق 30 طلباً في الدقيقة. تتوفر تجربة عامة محدودة وفق سياسة الخادم.

### أسعار العملات

**GET** `/api/v1/currency/rate?base=USD&target=EUR`

يعيد سعر صرف مرجعياً يومياً من Frankfurter. الأسعار ليست أسعار تداول لحظية.

## الواجهة الأمامية

- صفحة رئيسية تعريفية.
- كتالوج API مع البحث والتصفية.
- Playground لتنفيذ طلبات حقيقية إلى المسارات المنشورة.
- توثيق تقني وأمثلة.
- تسجيل الدخول بالبريد وكلمة المرور وGoogle OAuth.
- لوحة تحكم تعرض تحليلات الاستخدام الخاصة بالمستخدم.
- إنشاء مفاتيح API وإلغاؤها.
- صفحة حالة الخدمات.

تقرأ الواجهة الخدمات من `public.api_services`، وتستخدم إجراءات Supabase الحالية: `bmg_create_api_key` و`bmg_list_api_keys` و`bmg_revoke_api_key` و`bmg_get_api_analytics`. لا تعرض بيانات تجريبية على أنها بيانات حقيقية.

## متغيرات البيئة

اضبط القيم التالية في Vercel أو في `.env.local` محلياً:

| المتغير | الاستخدام |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام Anon/Publishable |
| `GEMINI_SESSION_SECRET` | سر تشفير جلسات Gemini، 32 حرفاً على الأقل |
| `BMG_DEMO_RPC_SECRET` | سر داخلي للتحقق من طلبات التجربة العامة |
| متغيرات مزود Gemini الأخرى | حسب إعدادات خدمة Gemini الحالية |

لا تضع أسرار الخادم أو Service Role Key في متغيرات `NEXT_PUBLIC_` أو في المستودع.

## التشغيل المحلي

يتطلب Node.js 20.9 أو أحدث:

```bash
npm install
npm run dev
```

ثم افتح `http://localhost:3000`.

## فحوصات الجودة

```bash
npm run typecheck
npm run lint
npm run build
```

## مسارات المساعدة

- `GET /api/health` — فحص صحة التطبيق.
- `GET /api/openapi.json` — مواصفة OpenAPI 3.1.
- `GET /docs.md` — توثيق نصي.
- `GET /llms.txt` — ملخص مهيأ لأدوات الذكاء الاصطناعي.

## المصادقة والأمان

- Supabase Auth للمصادقة.
- تخزين بصمة مفتاح API بدلاً من المفتاح الأصلي.
- عرض المفتاح كاملاً مرة واحدة عند الإنشاء.
- إدارة المفاتيح والتحليلات عبر RPCs محمية.
- سياسات RLS لحماية بيانات المستخدمين.
- لا تضع مفاتيح API السرية في كود المتصفح.

## النشر

المستودع مرتبط بمشروع Vercel والفرع الأساسي هو `main`. يجب ضبط متغيرات البيئة وإعداد Google OAuth في Supabase قبل تفعيل وظائف الحسابات على الإنتاج.

---

**BMG APIs** — أدوات برمجية عملية وتجربة واضحة للمطورين.
