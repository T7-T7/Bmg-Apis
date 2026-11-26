const documentation = `# NOX APIS — توثيق المطورين

Official API reference: https://nox.bmg-inc.web.id

تضم Nox ثلاث خدمات API تشغيلية: Gemini للمحادثات النصية، GPTFree للردود مع سجل محادثة، وStar X لتوليد الصور وتعديلها. تستخدم جميع الخدمات POST وJSON في الطلب، لكن استجابة Star X الناجحة تكون بيانات صورة ثنائية.

## 1. البدء والمصادقة

- Base URL: `https://nox.bmg-inc.web.id`
- Method: `POST`
- Content-Type: `application/json`
- External authentication: `Authorization: Bearer YOUR_NOX_API_KEY`

أنشئ مفتاح API من لوحة Nox واحفظه في متغير بيئة أو مخزن أسرار خادمي. لا تضع المفتاح في كود المتصفح أو مستودع عام. صفحات الاختبار الرسمية داخل الموقع هي الاستثناء الوحيد الذي يمكنه استخدام وضع الاختبار دون مفتاح؛ لا تستخدم هذا الاستثناء في التطبيقات الخارجية.

تُحسب الحصص ومعدلات الطلبات بحسب الحساب والخطة والمفتاح والخدمة. لا يوجد رقم موحد مضمون لكل الحسابات؛ راجع لوحة الاستخدام، وتعامل مع HTTP 429 عند بلوغ الحد.

## 2. Gemini — توليد النص ومتابعة الجلسات

- Endpoint: `POST /api/v1/ai/gemini`
- Required: `prompt` — نص من 1 إلى 30,000 حرف.
- Optional: `instruction` — تعليمات نصية لتوجيه الإجابة.
- Optional: `sessionId` — معرّف الجلسة من استجابة سابقة لمتابعة المحادثة.
- Maximum HTTP body: 1 MB.

### Request

```json
{
  "prompt": "اشرح الفرق بين let و const",
  "instruction": "أجب باللغة العربية"
}
```

### cURL

```bash
curl -X POST "https://nox.bmg-inc.web.id/api/v1/ai/gemini" \
  -H "Authorization: Bearer YOUR_NOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"اشرح الفرق بين let و const","instruction":"أجب باللغة العربية"}'
```

### Success response

```json
{
  "success": true,
  "response": "النص الناتج من النموذج",
  "sessionId": "ENCRYPTED_SESSION_VALUE",
  "method": "gemini-web",
  "conversationId": null,
  "responseId": null,
  "access": "api_key"
}
```

أرسل `sessionId` في الطلب التالي للحفاظ على سياق الجلسة. قيمة `method` توضح مسار التنفيذ الذي نجح.

## 3. GPTFree — توليد النص مع سجل محادثة

- Endpoint: `POST /api/v1/ai/gptfree`
- Required: `message` — نص من 1 إلى 30,000 حرف.
- Optional: `history` — مصفوفة بحد أقصى 20 رسالة.
- كل عنصر في `history` يحتوي `type` بقيمة `user` أو `agent` أو `assistant`، و`content` كنص.
- Maximum HTTP body: 1 MB.

### Request

```json
{
  "message": "اشرح REST API",
  "history": [
    { "type": "user", "content": "ما معنى HTTP؟" },
    { "type": "assistant", "content": "هو بروتوكول اتصال..." }
  ]
}
```

### Success response

```json
{
  "success": true,
  "response": "النص الناتج",
  "provider": "gptfree",
  "access": "api_key"
}
```

## 4. Star X — توليد الصور وتعديلها

- Endpoint: `POST /api/v1/ai/star-x`
- Maximum HTTP body: 4 MB.
- `action` مطلوب، والقيم المدعومة:
  - `generate-image`: توليد صورة من وصف نصي؛ لا يحتاج `imageUrl`.
  - `edit-scene`: تعديل مشهد داخل صورة؛ يحتاج `imageUrl` و`prompt`.
  - `change-background`: تغيير خلفية الصورة؛ يحتاج `imageUrl` و`prompt`.
  - `improve-lighting`: تحسين إضاءة الصورة؛ يحتاج `imageUrl` ولا يحتاج `prompt`.
- `imageUrl` يجب أن يكون رابط HTTPS عامًا صالحًا عند الحاجة إليه.
- `prompt` مطلوب لتوليد الصور وتعديل المشهد وتغيير الخلفية، وبحد أقصى 4,000 حرف.
- التعليمات النصية في Star X يجب أن تكون باللغة الإنجليزية.
- الاستجابة الناجحة بيانات صورة ثنائية (image/*)، وليست JSON. استخدم `response.blob()` في المتصفح أو `response.arrayBuffer()` في Node.js.

### Request — generate image

```json
{
  "action": "generate-image",
  "prompt": "A cinematic photograph of a modern glass house beside a lake at sunset"
}
```

### Request — edit scene

```json
{
  "action": "edit-scene",
  "imageUrl": "https://example.com/source.jpg",
  "prompt": "Add warm cinematic lighting and a natural mountain background"
}
```

### JavaScript response handling

```js
const response = await fetch("https://nox.bmg-inc.web.id/api/v1/ai/star-x", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.NOX_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    action: "generate-image",
    prompt: "A cinematic glass house beside a lake at sunset"
  })
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || "Star X request failed");
}

const image = await response.blob();
```

## 5. أخطاء HTTP

- 400: جسم JSON غير صالح أو حقل مطلوب مفقود أو قيمة غير مدعومة.
- 401: ترويسة Authorization غير صحيحة أو مفتاح API مفقود/غير صالح.
- 403: الحساب موقوف أو المفتاح لا يملك صلاحية الخدمة.
- 413: تجاوز حد حجم الطلب أو حد النص المحدد للخدمة.
- 429: تجاوز معدل الطلبات أو الحصة؛ افحص ترويسة Retry-After عند وجودها.
- 502: فشل المزود الخارجي أو لم يُرجع نتيجة صالحة.
- 503: الخدمة أو نظام التفويض غير متاح مؤقتًا.

استجابات Gemini وGPTFree الناجحة بصيغة JSON. استجابة Star X الناجحة صورة ثنائية، بينما أخطاء Star X ترجع JSON يحتوي success=false وerror وcode.

## موارد المطورين

- OpenAPI 3.1: https://nox.bmg-inc.web.id/api/openapi.json
- Markdown: https://nox.bmg-inc.web.id/docs.md
- LLM index: https://nox.bmg-inc.web.id/llms.txt
- API catalog: https://nox.bmg-inc.web.id/apis
- Service status: https://nox.bmg-inc.web.id/status

لا تعتبر أي مسار غير مدرج في مواصفات OpenAPI أو هذا الدليل واجهة إنتاج متاحة.
`;

export async function GET() {
  return new Response(documentation, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
