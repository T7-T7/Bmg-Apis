# Bmg-Apis

منصة مصرية للمطورين لاستكشاف واجهات API واختبارها وإدارة مفاتيح الوصول.

## التقنية
- Next.js 16 App Router
- React 19
- TypeScript مع Strict Mode
- Supabase للمصادقة وإدارة مفاتيح API
- Vercel للنشر

## التشغيل المحلي
```bash
npm install
npm run dev
```

## فحوصات الجودة
```bash
npm run typecheck
npm run lint
npm run build
```

## شجرة المشروع
```text
app/
  api/
    health/route.ts
    openapi.json/route.ts
    v1/
      ai/gemini/route.ts
      currency/rate/route.ts
  apis/
    [slug]/page.tsx
    page.tsx
  auth/callback/page.tsx
  dashboard/
    api-keys/page.tsx
    page.tsx
  docs/page.tsx
  login/page.tsx
  playground/page.tsx
  signup/page.tsx
  status/page.tsx
  page.tsx
  layout.tsx
  globals.css

components/
  api/
  dashboard/
  globe/
  layout/
  navigation/
  ui/
  auth-form.tsx
  api-key-manager.tsx
  landing-page.tsx

lib/
  api/catalog.ts
  server/gemini.ts
  services/health.ts
  supabase/client.ts

types/
  api.ts
```

## الخدمات المنشورة فعليًا
- **POST /api/v1/ai/gemini** — Gemini text generation، مع مصادقة Bearer API Key.
- **GET /api/v1/currency/rate?base=USD&target=EUR** — أسعار صرف مرجعية يومية من Frankfurter.

كلا المسارين يتحققان من مفتاح Nox API وصلاحية الخدمة وحد الطلبات على الخادم. لا يتم تضمين المفاتيح السرية في كود المتصفح.

بقية عناصر الكتالوج تظهر كـ **قيد التطوير** ولا تُقدَّم على أنها endpoints عاملة. Playground يرسل طلبات حقيقية إلى المسارين المنشورين فقط.

## المصادقة والمفاتيح
- Google OAuth عبر Supabase.
- إنشاء وإلغاء مفاتيح API عبر إجراءات قاعدة البيانات الحالية.
- تخزين بصمة المفتاح بدل المفتاح الأصلي.
- عرض قيمة المفتاح مرة واحدة عند إنشائه.

## النشر
يتم النشر عبر Vercel المرتبط بفرع **main**. تحفظ متغيرات البيئة الحساسة في إعدادات المشروع، ولا تُضمّن في المستودع.
