import { NextResponse } from "next/server";

const specification = {
  openapi: "3.1.0",
  info: {
    title: "NOX APIS — NEXUS OF XPERIENCE",
    version: "1.0.0",
    description: "الواجهة المنشورة حاليًا من منصة NOX APIS — NEXUS OF XPERIENCE. يحتوي هذا الملف على المسارات التشغيلية الفعلية فقط. صفحات الاختبار داخل الموقع تعمل دون API Key؛ لا تضف حقلًا للمفتاح في واجهة الاختبار.",
    contact: { name: "NOX APIS", url: "https://bmg-apis-b2-902b.vercel.app/docs" },
  },
  servers: [{ url: "https://bmg-apis-b2-902b.vercel.app", description: "Production" }],
  tags: [{ name: "AI", description: "واجهات الذكاء الاصطناعي" }],
  paths: {
    "/api/v1/ai/gptfree": {
      post: {
        tags: ["AI"], operationId: "generateGptFreeResponse",
        summary: "إنشاء رد باستخدام GPTFree",
        description: "يرسل رسالة إلى GPTFree ويعيد الرد النصي. يدعم سجل محادثة history بحد أقصى 20 رسالة. اختبار الخدمة من صفحات الموقع لا يحتاج API Key ولا يعرض حقلًا لإدخاله؛ يمكن استخدام Bearer API Key اختياريًا للتكاملات الخارجية.",
        security: [{}, { NoxApiKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", additionalProperties: false, required: ["message"],
          properties: {
            message: { type: "string", minLength: 1, maxLength: 30000 },
            history: { type: "array", maxItems: 20, items: { type: "object", required: ["type", "content"], properties: {
              type: { type: "string", enum: ["user", "agent", "assistant"] }, content: { type: "string" }
            } } }
          }
        }, example: { message: "اشرح REST API", history: [] } } } },
        responses: {
          "200": { description: "تم إنشاء الرد." },
          "400": { description: "طلب غير صالح." }, "401": { description: "مفتاح API المرسل غير صالح أو ملغى." },
          "429": { description: "تجاوز حد الاستخدام." }, "502": { description: "تعذر الحصول على رد من GPTFree." },
          "503": { description: "الخدمة غير متاحة." }
        }
      }
    },
    "/api/v1/ai/star-x": {
      post: {
        tags: ["AI"], operationId: "runStarXImageTool",
        summary: "تشغيل أدوات Star X للصور",
        description: "تعديل المشهد وتوليد الصور وتغيير الخلفية وتحسين الإضاءة باستخدام أداة AI Shadows. التعليمات الإنجليزية فقط؛ النموذج لا يفهم العربية. اختبار الخدمة من صفحات الموقع لا يحتاج API Key ولا يعرض حقلًا لإدخاله؛ يمكن استخدام Bearer API Key اختياريًا للتكاملات الخارجية.",
        security: [{}, { NoxApiKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", additionalProperties: false, required: ["action"],
          properties: {
            action: { type: "string", enum: ["edit-scene", "generate-image", "change-background", "improve-lighting"] },
            imageUrl: { type: "string", format: "uri", description: "HTTPS image URL; required except for generate-image." },
            prompt: { type: "string", maxLength: 4000, description: "English prompt only." }
          }
        }, example: { action: "generate-image", prompt: "A cinematic photograph of a modern glass house beside a lake at sunset" } } } },
        responses: {
          "200": { description: "Generated image binary (image/*)." },
          "400": { description: "Invalid request or unsupported prompt language." },
          "401": { description: "Invalid API key supplied in the request." },
          "429": { description: "Rate limit exceeded." },
          "502": { description: "Provider execution failed." },
          "503": { description: "Service unavailable." }
        }
      }
    },
    "/api/v1/ai/gemini": {
      post: {
        tags: ["AI"],
        operationId: "generateGeminiResponse",
        summary: "إنشاء رد باستخدام Gemini",
        description: "يرسل prompt إلى Gemini ويعيد الرد ومعرّف جلسة يمكن تمريره في الطلب التالي لمتابعة المحادثة. الحد الأقصى لـ prompt هو 30000 حرف. الحد الحالي 30 طلبًا في الدقيقة لكل مفتاح API. اختبار الخدمة من صفحات الموقع لا يحتاج API Key ولا يعرض حقلًا لإدخاله؛ يمكن استخدام Bearer API Key اختياريًا للتكاملات الخارجية.",
        security: [{}, { NoxApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["prompt"],
                properties: {
                  prompt: { type: "string", minLength: 1, maxLength: 30000, description: "النص المراد إرساله إلى النموذج." },
                  instruction: { type: "string", description: "تعليمات اختيارية لتوجيه أسلوب الإجابة." },
                  sessionId: { type: "string", description: "معرّف الجلسة من الاستجابة السابقة لمتابعة المحادثة." }
                }
              },
              example: { prompt: "اشرح الفرق بين let و const", instruction: "أجب باللغة العربية" }
            }
          }
        },
        responses: {
          "200": {
            description: "تم إنشاء الرد بنجاح.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "response", "sessionId", "method"],
                  properties: {
                    success: { type: "boolean", const: true },
                    response: { type: "string" },
                    sessionId: { type: "string" },
                    method: { type: "string", enum: ["gemini-web", "gemini-fallback"] },
                    conversationId: { type: ["string", "null"] },
                    responseId: { type: ["string", "null"] }
                  }
                }
              }
            }
          },
          "400": { description: "طلب غير صالح أو حقل مطلوب مفقود." },
          "401": { description: "مفتاح API المرسل غير صالح أو ملغى." },
          "413": { description: "تجاوز prompt الحد الأقصى البالغ 30000 حرف." },
          "429": { description: "تجاوز حد الطلبات." },
          "502": { description: "تعذر الحصول على رد من مزود النموذج." },
          "503": { description: "الخدمة أو التحقق من المفتاح غير متاح مؤقتًا." }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      NoxApiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "NOX APIS API Key",
        description: "اختياري للتكاملات الخارجية فقط. صفحات الاختبار داخل موقع NOX APIS لا تحتاج هذا المفتاح، ويجب ألا تعرض حقلًا لإدخاله. عند استخدام مفتاح خارجي أرسله في Authorization: Bearer YOUR_NOX_API_KEY."
      }
    }
  }
};

export async function GET() {
  return NextResponse.json(specification, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
