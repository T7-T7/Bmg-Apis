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

الواجهة الأمامية وصفحاتها التفاعلية جاهزة للمعاينة. بيانات الكتالوج الحالية نماذج تجريبية، ومنشئ الواجهات ينشئ معاينة محلية فقط.

لم يتم بعد تنفيذ خدمات الخادم الخلفي، أو المصادقة، أو قاعدة البيانات، أو إدارة مفاتيح API، أو تشغيل ونشر نقاط الاتصال التي ينشئها المستخدم. لا تعتبر المسارات المعروضة واجهات تشغيلية قبل ربط هذه المكونات واختبارها.

## النشر

المشروع معد للنشر على Vercel. يجب حفظ مفاتيح الخدمات وقيم البيئة الحساسة في إعدادات الخادم فقط، وعدم تضمينها في مكونات المتصفح.
