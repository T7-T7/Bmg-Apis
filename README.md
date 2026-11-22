# NOX APIS — NEXUS OF XPERIENCE

منصة مطورين لإدارة مفاتيح API، استكشاف الخدمات المنشورة، اختبار الطلبات، ومراجعة استخدام الواجهات من لوحة واحدة.

## الحالة الحالية

- **الواجهة:** Next.js App Router + React + TypeScript.
- **المصادقة وإدارة المفاتيح:** Supabase Auth وRPCs الموجودة في قاعدة البيانات.
- **النشر:** Vercel — فرع الإنتاج `main`.
- **التصميم:** واجهة عربية RTL، وضع داكن، متجاوبة مع الهاتف وسطح المكتب.
- **لا يتم تعديل مخطط Supabase أو سياسات RLS عند تشغيل الواجهة.**

## الخدمات النشطة

هذه هي الخدمات التي تم التحقق من وجودها وحالتها `active` في سجل الخدمات:

| الخدمة | الطريقة | المسار | المصدر |
|---|---|---|---|
| عقل — Gemini | POST | `/api/v1/ai/gemini` | Gemini |
| GPTFree | POST | `/api/v1/ai/gptfree` | GPTFree |

لا تعرض الواجهة خدمات مستقبلية على أنها متاحة. أي خدمة غير موجودة في قائمة الخدمات النشطة لا تعد جزءاً من واجهات الإنتاج.

## صفحات المنصة

| المسار | الوظيفة |
|---|---|
| `/` | الصفحة الرئيسية والتعريف بالخدمات |
| `/apis` | كتالوج نقاط الاتصال النشطة |\n| `/models` | كتالوج النماذج وقدراتها وتفاصيلها |\n| `/models/[slug]` | تفاصيل نموذج مستقل |
| `/apis/aql-gemini` | تفاصيل واجهة Gemini |
| `/apis/gptfree` | تفاصيل واجهة GPTFree |
| `/playground` | تجربة النماذج ومقارنة الاستجابات وزمن التنفيذ |
| `/docs` و`/docs/[section]` | توثيق مقسم إلى تبويبات وصفحات مستقلة |\n| `/reference` | مرجع واجهة برمجة التطبيقات |
| `/status` | فحوصات التطبيق وقاعدة البيانات والحوادث والصيانة |\n| `/upgrade` | صفحة الخطط والترقية؛ لا تعرض أسعارًا غير مسجلة |\n| `/cookies` | سياسة ملفات تعريف الارتباط وإدارة الموافقات |\n| `/support` | مجموعة دعم WhatsApp وتسجيل تقييم التجربة |
| `/changelog` | سجل التحديثات العامة |
| `/limits` | حدود الاستخدام |
| `/faq` | الأسئلة الشائعة |
| `/support` | الدعم الفني عبر واتساب |
| `/privacy` | سياسة الخصوصية |
| `/terms` | شروط الاستخدام |
| `/dashboard/logs` | سجل آخر طلبات API |
| `/dashboard/analytics` | تحليلات الاستخدام |
| `/login` | تسجيل الدخول بالبريد أو Google |
| `/signup` | إنشاء حساب |
| `/dashboard` | إحصاءات الاستخدام |
| `/dashboard/api-keys` | إدارة المفاتيح في بطاقات أو جدول، وتعديل الاسم وإيقاف المفتاح |\n| `/dashboard/api-keys/new` | إنشاء مفتاح API مستقل مع إعدادات متقدمة |\n| `/dashboard/settings` | الحساب والمظهر واللغة والإشعارات والخصوصية والجلسات والأمان |
| `/dashboard/submissions` | إرسال ومتابعة طلبات إضافة واجهات API |

## شجرة المشروع الفعلية

```text
.
├── .github/
│   └── workflows/ci.yml
├── app/
│   ├── api/
│   │   ├── health/route.ts
│   │   ├── openapi.json/route.ts
│   │   └── v1/
│   │       ├── ai/gemini/route.ts
│   │       ├── ai/gemini/route.ts\n│       └── ai/gptfree/route.ts
│   ├── apis/
│   │   ├── [slug]/page.tsx
│   │   └── page.tsx
│   ├── auth/callback/page.tsx
│   ├── dashboard/
│   │   ├── api-keys/page.tsx
│   │   ├── submissions/page.tsx
│   │   └── page.tsx
│   ├── docs/page.tsx
│   ├── login/page.tsx
│   ├── playground/page.tsx
│   ├── signup/page.tsx
│   ├── status/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── backend/
│   └── README.md
├── components/
│   └── portal.tsx
├── lib/
│   ├── server/
│   │   └── gemini.ts
│   ├── services/
│   │   └── health.ts
│   └── supabase/
│       └── client.ts
├── supabase/
│   └── migrations/
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
└── tsconfig.json
```

## المتطلبات

- Node.js `>=20.9.0 <27`.
- npm.
- مشروع Supabase مرتبط.
- مشروع Vercel مرتبط بالمستودع.

## متغيرات البيئة

تُضبط القيم في Vercel Project Settings ولا تحفظ داخل Git:

| المتغير | الاستخدام |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح Supabase العام (anon/publishable) |
| `GEMINI_SESSION_SECRET` | سر خادمي بطول 32 حرفاً على الأقل لتشفير جلسات Gemini وتجزئة معرف العميل |
| `BMG_DEMO_RPC_SECRET` | السر الخادمي المطابق للبصمة المسجلة في `private.api_demo_config` |
| `GEMINI_TIMEOUT_MS` | مهلة Gemini بالمللي ثانية؛ اختياري، الافتراضي 45000 |

لا تستخدم `service_role` أو أي سر خادمي في متغير يبدأ بـ `NEXT_PUBLIC_`. لا تشارك قيم الأسرار في سجلات البناء أو الواجهة.

## التشغيل المحلي

```bash
npm install
npm run dev
```

أنشئ ملف `.env.local` محلياً بالقيم المطلوبة قبل اختبار المصادقة أو خدمات API.

## فحوصات الجودة

```bash
npm run typecheck
npm run lint
npm run build
```

## المصادقة ومفاتيح API

تستخدم الواجهة وظائف Supabase الحالية:

- `bmg_create_api_key(p_key, p_label)`
- `bmg_list_api_keys()`
- `bmg_revoke_api_key(p_id)`
- `bmg_get_api_analytics(p_days)`

يُنشأ المفتاح بصيغة `nox_live_...` ويُخزن hash المفتاح في قاعدة البيانات. تعرض الواجهة القيمة السرية مرة واحدة عند الإنشاء فقط. زر الحذف في صفحة الإدارة يستخدم `bmg_revoke_api_key` لإيقاف المفتاح مع الاحتفاظ بسجله؛ لا ينفذ حذفًا ماديًا للسجل.

تسجيل الدخول في الواجهة يعتمد على Google OAuth وGitHub OAuth فقط، بترتيب Google أولًا. لا توجد حقول بريد/كلمة مرور محلية. يجب تفعيل المزودين في Supabase Auth وضبط Redirect URLs لتشمل نطاق الإنتاج ومسار `/auth/callback`.

## الملاحظات والخصوصية\n\n- موافقات ملفات تعريف الارتباط تحفظ في Cookie محلي مع نسخة احتياطية محلية، ولا تُفعّل الفئات التحليلية أو التسويقية تلقائيًا.\n- صفحة الترقية تقرأ حدود الخطط من `api_plan_limits` وبيانات الخطة الحالية من `profiles`؛ الأسعار وسجل الاشتراكات لا يعرضان ما لم تتوفر بيانات فعلية.\n- إشعارات تغيّر الحالة تعمل عبر إشعارات المتصفح أثناء بقاء صفحة الحالة مفتوحة، وليست Push Notifications في الخلفية.\n- نموذج الملاحظات يستخدم جدول `public.user_feedback` وسياسات RLS. يجب تطبيق الترحيل `supabase/migrations/202611230001_user_feedback.sql` على Supabase قبل تفعيل الإرسال والمتابعة من قاعدة البيانات. لم يتم تطبيق الترحيل على المشروع البعيد ضمن هذا التغيير.\n- حالة Uptime التاريخية وزمن أداء المزودين لا تُعرض كقيم حقيقية ما لم تتوفر قياسات مخزنة؛ صفحة الحالة تعرض الفحوصات اللحظية والحوادث المسجلة فقط.\n\n## استخدام API

### Gemini

```bash
curl -X POST "https://bmg-apis-b2-902b.vercel.app/api/v1/ai/gemini" \
  -H "Authorization: Bearer YOUR_NOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"اشرح REST API","instruction":"أجب بالعربية"}'
```

الحقول:
- `prompt`: مطلوب، من 1 إلى 30000 حرف.
- `instruction`: تعليمات اختيارية.
- `sessionId`: معرّف اختياري من الاستجابة السابقة لمتابعة المحادثة.

### GPTFree

```bash
curl -X POST "https://bmg-apis-b2-902b.vercel.app/api/v1/ai/gptfree" \
  -H "Authorization: Bearer YOUR_NOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"اشرح REST API","history":[]}'
```

الحقول:
- `message`: مطلوب، من 1 إلى 30000 حرف.
- `history`: سجل اختياري لآخر 20 رسالة، وكل عنصر يحتوي `type` و`content`.

## حدود الاستخدام والاستجابات

- مفاتيح API: 30 طلباً في الدقيقة لكل مفتاح.
- التجربة العامة لها حدود أقل يفرضها الخادم.
- `400`: طلب غير صالح.
- `401`: مفتاح غير صالح أو ملغى.
- `413`: تجاوز حد الحجم أو النص.
- `422`: رمز عملة غير مدعوم.
- `429`: تجاوز حد الطلبات.
- `502`: تعذر تنفيذ الطلب لدى المصدر الخارجي.
- `503`: الخدمة أو التفويض غير متاح مؤقتاً.

## الدعم الفني\n\nمجموعة الدعم الفني: https://chat.whatsapp.com/JvIsngFNWwIEvacsMqKUzX?s=cl&p=a&iam=2\n\n## موارد المطورين

- فحص الصحة: `/api/health`
- مواصفات OpenAPI: `/api/openapi.json`
- توثيق Markdown: `/docs.md`
- فهرس LLM: `/llms.txt`

## النشر

المستودع مرتبط بفرع `main`. نشر الإنتاج يجب أن يستهدف بيئة Vercel المسماة **Production**. لا تستخدم Preview لهذا المشروع عند تحديث واجهة الإنتاج. بعد النشر، اختبر الصفحات والمصادقة ومفاتيح API والمسارين النشطين من نطاق الإنتاج.

## ملاحظات هندسية

- الواجهة تتصل بـ Supabase باستخدام المفتاح العام فقط؛ صلاحيات إدارة المفاتيح والتحليلات تبقى داخل RPCs المحمية.
- استدعاءات Gemini وأسرار الجلسات تنفذ على الخادم.
- لا تضف مفاتيح أو أسرار حقيقية إلى ملفات المصدر.
- لا تعتبر حالة صفحة Status بديلاً عن مراقبة خارجية مستمرة أو فحص فعلي لكل مزود.
