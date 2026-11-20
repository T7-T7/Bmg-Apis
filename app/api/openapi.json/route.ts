import { NextResponse } from "next/server";

const specification = {
  openapi: "3.1.0",
  info: {
    title: "NOX APIS — NEXUS OF XPERIENCE",
    version: "1.0.0",
    description: "الواجهة المنشورة حاليًا من منصة NOX APIS — NEXUS OF XPERIENCE. يحتوي هذا الملف على المسارات التشغيلية الفعلية فقط.",
    contact: { name: "NOX APIS", url: "https://bmg-apis-b2-902b.vercel.app/docs" },
  },
  servers: [{ url: "https://bmg-apis-b2-902b.vercel.app", description: "Production" }],
  tags: [{ name: "AI", description: "واجهات الذكاء الاصطناعي" }],
  paths: {
    "/api/v1/ai/gptfree": {
      post: {
        tags: ["AI"], operationId: "generateGptFreeResponse",
        summary: "إنشاء رد باستخدام GPTFree",
        description: "يرسل رسالة إلى GPTFree ويعيد الرد النصي. يدعم سجل محادثة history بحد أقصى 20 رسالة.",
        security: [{ NoxApiKey: [] }],
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
          "200": { description: "تم إنشاء الرد.", content: { "application/json": { schema: { type: "object", properties: {
            success: { type: "boolean", const: true }, response: { type: "string" }, provider: { type: "string", const: "gptfree" }
          } } } } },
          "400": { description: "طلب غير صالح." }, "401": { description: "مفتاح API غير صالح." },
          "429": { description: "تجاوز حد الاستخدام." }, "502": { description: "تعذر الحصول على رد من GPTFree." },
          "503": { description: "الخدمة غير متاحة." }
        }
      }
    },
    "/api/v1/ai/gemini": {
      post: {
        tags: ["AI"],
        operationId: "generateGeminiResponse",
        summary: "إنشاء رد باستخدام Gemini",
        description: "يرسل prompt إلى Gemini ويعيد الرد ومعرّف جلسة يمكن تمريره في الطلب التالي لمتابعة المحادثة. الحد الأقصى لـ prompt هو 30000 حرف. الحد الحالي 30 طلبًا في الدقيقة لكل مفتاح API.",
        security: [{ NoxApiKey: [] }],
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
          "401": { description: "مفتاح API مفقود أو غير صالح أو ملغى." },
          "413": { description: "تجاوز prompt الحد الأقصى البالغ 30000 حرف." },
          "429": { description: "تجاوز حد الطلبات: 30 طلبًا في الدقيقة لكل مفتاح." },
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
        description: "أنشئ مفتاحًا من لوحة Nox Apis وأرسله في Authorization: Bearer YOUR_NOX_API_KEY."
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
