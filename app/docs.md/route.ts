const documentation = `# NOX APIS — توثيق المطورين

Official API reference: https://nox.bmg-inc.web.id

Nox هي مقدم خدمات API والجهة المسؤولة عن تشغيل المنصة وإدارة واجهاتها للمطورين. تتولى خوادم Nox استقبال الطلبات والتحقق من مفاتيح API وتطبيق الصلاحيات والحصص وتسجيل الاستخدام وتنسيق تنفيذ الخدمات. يتعامل المطور مع Nox مباشرة عبر عنوان API موحد، ولا يحتاج إلى الاتصال بمزودي النماذج أو إدارة تكاملاتهم.\n\nقد تعتمد بعض عمليات المعالجة خلف واجهة Nox على مزودي نماذج أو تشغيل متخصصين تستخدمهم المنصة؛ لذلك لا يعني وصف Nox بأنها مقدم الخدمة أن جميع أوزان النماذج أو عمليات الاستدلال مستضافة ذاتيًا على خوادمها. تظل Nox هي الجهة التي تقدم واجهة API وتدير الوصول إليها.\n\nتضم المنصة أربع خدمات: Gemini وGPTFree وChatGPT للمحادثات النصية، وStar X لتوليد الصور وتعديلها. تستخدم جميع الخدمات POST وJSON في الطلب، لكن استجابة Star X الناجحة تكون بيانات صورة ثنائية.

## 1. البدء والمصادقة

- Base URL: \x60https://nox.bmg-inc.web.id\x60
- Method: \x60POST\x60
- Content-Type: \x60application/json\x60
- External authentication: \x60Authorization: Bearer YOUR_NOX_API_KEY\x60
- Format of newly issued keys: \x60nox_\x60 followed by 52 letters, digits, underscores, or hyphens. Send the complete key unchanged after \x60Bearer\x60.

أنشئ مفتاح API من لوحة Nox واحفظه في متغير بيئة أو مخزن أسرار خادمي. لا تضع المفتاح في كود المتصفح أو مستودع عام. صفحات الاختبار الرسمية داخل الموقع هي الاستثناء الوحيد الذي يمكنه استخدام وضع الاختبار دون مفتاح؛ لا تستخدم هذا الاستثناء في التطبيقات الخارجية.

تُحسب الحصص ومعدلات الطلبات بحسب الحساب والخطة والمفتاح والخدمة. تدير Nox هذه الحدود وتعرض بيانات الاستخدام من خلال لوحة الحساب؛ لا يوجد رقم موحد مضمون لكل الحسابات. راجع لوحة الاستخدام، وتعامل مع HTTP 429 عند بلوغ الحد.\n\nتعمل نقاط الاتصال الثلاث ضمن طبقة API التي تديرها Nox. وقد يظهر في رسائل الأخطاء رمز يشير إلى تعذر الوصول إلى مزود التنفيذ الذي تعتمد عليه عملية معينة؛ هذا لا يغيّر نقطة الاتصال التي يستخدمها المطور، وهي Nox.

## 2. Gemini — توليد النص ومتابعة الجلسات

- Endpoint: \x60POST /api/v1/ai/gemini\x60
- Required: \x60prompt\x60 — نص من 1 إلى 30,000 حرف.
- Optional: \x60instruction\x60 — تعليمات نصية لتوجيه الإجابة.
- Optional: \x60sessionId\x60 — معرّف الجلسة من استجابة سابقة لمتابعة المحادثة.
- Maximum HTTP body: 1 MB.

### Request

\x60\x60\x60json
{
  "prompt": "اشرح الفرق بين let و const",
  "instruction": "أجب باللغة العربية"
}
\x60\x60\x60

### cURL

\x60\x60\x60bash
curl -X POST "https://nox.bmg-inc.web.id/api/v1/ai/gemini" \
  -H "Authorization: Bearer YOUR_NOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"اشرح الفرق بين let و const","instruction":"أجب باللغة العربية"}'
\x60\x60\x60

### Success response

\x60\x60\x60json
{
  "success": true,
  "response": "النص الناتج من النموذج",
  "sessionId": "ENCRYPTED_SESSION_VALUE",
  "method": "gemini-web",
  "conversationId": null,
  "responseId": null,
  "access": "api_key"
}
\x60\x60\x60

أرسل \x60sessionId\x60 في الطلب التالي للحفاظ على سياق الجلسة. قيمة \x60method\x60 توضح مسار التنفيذ الذي نجح.

## 3. GPTFree — توليد النص مع سجل محادثة

- Endpoint: \x60POST /api/v1/ai/gptfree\x60
- Required: \x60message\x60 — نص من 1 إلى 30,000 حرف.
- Optional: \x60history\x60 — مصفوفة بحد أقصى 20 رسالة.
- كل عنصر في \x60history\x60 يحتوي \x60type\x60 بقيمة \x60user\x60 أو \x60agent\x60 أو \x60assistant\x60، و\x60content\x60 كنص.
- Maximum HTTP body: 1 MB.

### Request

\x60\x60\x60json
{
  "message": "اشرح REST API",
  "history": [
    { "type": "user", "content": "ما معنى HTTP؟" },
    { "type": "assistant", "content": "هو بروتوكول اتصال..." }
  ]
}
\x60\x60\x60

### Success response

\x60\x60\x60json
{
  "success": true,
  "response": "النص الناتج",
  "provider": "gptfree",
  "access": "api_key"
}
\x60\x60\x60

## 4. ChatGPT — المحادثة النصية ومتابعة الجلسات

- Endpoint: \x60POST /api/v1/ai/chatgpt\x60
- Required: \x60message\x60 — نص من 1 إلى 30,000 حرف.
- Optional: \x60model\x60 — إحدى القيم \x60default\x60 أو \x60auto\x60 أو \x60gpt-4\x60 أو \x60gpt-3.5\x60؛ الافتراضي \x60default\x60.
- Optional: \x60sessionId\x60 — قيمة مشفرة من الاستجابة السابقة لاستكمال المحادثة نفسها.
- Maximum HTTP body: 1 MB.
- مدة تشغيل مسار Vercel محددة بـ 300 ثانية؛ ومهلة تدفق ChatGPT مضبوطة على 260 ثانية لترك وقت للمصادقة وتهيئة الجلسة وتسجيل الاستخدام.
- يعتمد التنفيذ على واجهة ChatGPT Web داخلية غير رسمية، وليس OpenAI API الرسمية؛ وقد تتغير أو تتوقف دون إشعار.

### Request

\x60\x60\x60json
{
  "message": "اشرح async/await",
  "model": "default"
}
\x60\x60\x60

### cURL

\x60\x60\x60bash
curl -X POST "https://nox.bmg-inc.web.id/api/v1/ai/chatgpt" \\
  -H "Authorization: Bearer YOUR_NOX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"اشرح async/await","model":"default"}'
\x60\x60\x60

### Success response

\x60\x60\x60json
{
  "success": true,
  "result": { "think": "", "message": "النص الناتج من ChatGPT" },
  "sessionId": "ENCRYPTED_SESSION_VALUE",
  "provider": "chatgpt",
  "model": "default",
  "access": "api_key"
}
\x60\x60\x60

أرسل \x60sessionId\x60 في الطلب التالي لمتابعة المحادثة. الجلسة تحتوي على بيانات اتصال مشفرة ولا تكشف الكوكيز الخام.

## 5. Star X — توليد الصور وتعديلها

- Endpoint: \x60POST /api/v1/ai/star-x\x60
- Maximum HTTP body: 4 MB.
- \x60action\x60 مطلوب، والقيم المدعومة:
  - \x60generate-image\x60: توليد صورة من وصف نصي؛ لا يحتاج \x60imageUrl\x60.
  - \x60edit-scene\x60: تعديل مشهد داخل صورة؛ يحتاج \x60imageUrl\x60 و\x60prompt\x60.
  - \x60change-background\x60: تغيير خلفية الصورة؛ يحتاج \x60imageUrl\x60 و\x60prompt\x60.
  - \x60improve-lighting\x60: تحسين إضاءة الصورة؛ يحتاج \x60imageUrl\x60 ولا يحتاج \x60prompt\x60.
- \x60imageUrl\x60 يجب أن يكون رابط HTTPS عامًا صالحًا عند الحاجة إليه.
- \x60prompt\x60 مطلوب لتوليد الصور وتعديل المشهد وتغيير الخلفية، وبحد أقصى 4,000 حرف.
- التعليمات النصية في Star X يجب أن تكون باللغة الإنجليزية.
- الاستجابة الناجحة بيانات صورة ثنائية (image/*)، وليست JSON. استخدم \x60response.blob()\x60 في المتصفح أو \x60response.arrayBuffer()\x60 في Node.js.

### Request — generate image

\x60\x60\x60json
{
  "action": "generate-image",
  "prompt": "A cinematic photograph of a modern glass house beside a lake at sunset"
}
\x60\x60\x60

### Request — edit scene

\x60\x60\x60json
{
  "action": "edit-scene",
  "imageUrl": "https://example.com/source.jpg",
  "prompt": "Add warm cinematic lighting and a natural mountain background"
}
\x60\x60\x60

### JavaScript response handling

\x60\x60\x60js
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
\x60\x60\x60

## 6. أخطاء HTTP

- 400: جسم JSON غير صالح أو حقل مطلوب مفقود أو قيمة غير مدعومة.
- 401: ترويسة Authorization غير صحيحة أو مفتاح API مفقود/غير صالح.
- 403: الحساب موقوف أو المفتاح لا يملك صلاحية الخدمة.
- 413: تجاوز حد حجم الطلب أو حد النص المحدد للخدمة.
- 429: تجاوز معدل الطلبات أو الحصة؛ افحص ترويسة Retry-After عند وجودها.
- 502: فشل المزود الخارجي أو لم يُرجع نتيجة صالحة.
- 503: الخدمة أو نظام التفويض غير متاح مؤقتًا.

استجابات Gemini وGPTFree وChatGPT الناجحة بصيغة JSON. استجابة Star X الناجحة صورة ثنائية، بينما أخطاء Star X ترجع JSON يحتوي success=false وerror وcode.

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
