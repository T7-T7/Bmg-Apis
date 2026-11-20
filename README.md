# Nox Apis

بوابة عربية للمطورين لاستكشاف واجهات برمجة التطبيقات وتجهيز تعريفاتها وإدارة تكاملاتها.

## التقنيات

- Next.js 16 مع App Router
- React 19
- TypeScript بوضع Strict
- Lucide React للأيقونات
- CSS مخصص ومتجاوب مع RTL
- Vercel للنشر

## المتطلبات

- Node.js 20.9 أو أحدث
- npm

## التشغيل محليًا

```bash
npm install
npm run dev
```

## فحوصات المشروع

```bash
npm run typecheck
npm run lint
npm run build
```

## الصفحات

| المسار | الوظيفة |
| --- | --- |
| `/` | لوحة النظرة العامة |
| `/apis` | كتالوج الواجهات والبحث والتصفية |
| `/apis/[slug]` | تفاصيل كل واجهة |
| `/create` | منشئ تعريف الواجهة والمعاينة |
| `/my-apis` | مساحة إدارة الواجهات |
| `/docs` | مركز التوثيق |
| `/status` | حالة مكونات المنصة |

## الهيكلة

```text
app/
  apis/
    [slug]/page.tsx
    page.tsx
  create/page.tsx
  docs/page.tsx
  my-apis/page.tsx
  status/page.tsx
  globals.css
  layout.tsx
  loading.tsx
  not-found.tsx
components/
  app-shell.tsx
  api-card.tsx
lib/
  api-data.ts
backend/
  README.md
public/
  bmg-apis-mark.svg
```

## حالة التنفيذ الحالية

تم ربط التطبيق بقاعدة Supabase وتشغيل المصادقة وإدارة مفاتيح Nox API، مع تخزين بصمة SHA-256 للمفتاح والتحقق من صلاحيته ومعدل استخدامه على الخادم.

الخدمات التشغيلية الحالية هي Gemini عبر `POST /api/v1/ai/gemini` وأسعار العملات عبر `GET /api/v1/currency/rate`. تدعم المسارات مفاتيح `nox_live_` والتحقق من الخدمة وحد 30 طلبًا في الدقيقة لكل مفتاح. يدعم Gemini حد prompt قدره 30 ألف حرف وحجم جسم طلب أقصى 1 MB. تعتمد أسعار العملات على Frankfurter وتُعد أسعارًا مرجعية يومية وليست أسعار تداول لحظية.

طلبات إضافة واجهات المجتمع تُحفظ للمراجعة، لكنها لا تُشغّل تلقائيًا. واجهتا توليد الصور وأسعار العملات في Playground ما زالتا معاينتين ولا تمثلان خدمات إنتاجية. لا يوجد حتى الآن Sandbox معزول لتشغيل كود المستخدم أو دورة اعتماد ونشر آلية له.

## النشر

المشروع معد للنشر على Vercel. يجب حفظ مفاتيح الخدمات وقيم البيئة الحساسة في إعدادات الخادم فقط، وعدم تضمينها في مكونات المتصفح.
