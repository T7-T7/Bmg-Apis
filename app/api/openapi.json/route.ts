import { NextResponse } from "next/server";

const specification = {
  openapi: "3.1.0",
  info: {
    title: "Nox Apis",
    version: "1.0.0",
    description: "الواجهة المنشورة حاليًا من منصة Nox Apis. يحتوي هذا الملف على المسارات التشغيلية الفعلية فقط.",
    contact: { name: "Nox Apis", url: "https://bmg-apis-b2-902b.vercel.app/docs" },
  },
  servers: [{ url: "https://bmg-apis-b2-902b.vercel.app", description: "Production" }],
  tags: [{ name: "AI", description: "واجهات الذكاء الاصطناعي" }, { name: "Currency", description: "أسعار صرف العملات المرجعية" }],
  paths: {
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
    },
    "/api/v1/currency/rate": {
      get: {
        tags: ["Currency"],
        operationId: "getCurrencyRate",
        summary: "الحصول على سعر صرف مرجعي",
        description: "يعيد سعر الصرف المرجعي بين عملتين من Frankfurter. الأسعار يومية وليست أسعار تداول لحظية.",
        security: [{ NoxApiKey: [] }],
        parameters: [
          { in: "query", name: "base", required: false, schema: { type: "string", pattern: "^[A-Z]{3}$", default: "USD" }, description: "رمز العملة الأساسية." },
          { in: "query", name: "target", required: false, schema: { type: "string", pattern: "^[A-Z]{3}$", default: "EUR" }, description: "رمز العملة المستهدفة." }
        ],
        responses: {
          "200": {
            description: "سعر الصرف المرجعي.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "base", "target", "rate", "source", "rateType"],
                  properties: {
                    success: { type: "boolean", const: true },
                    base: { type: "string" },
                    target: { type: "string" },
                    rate: { type: "number", exclusiveMinimum: 0 },
                    date: { type: ["string", "null"], format: "date" },
                    source: { type: "string", const: "Frankfurter" },
                    rateType: { type: "string", const: "daily_reference" },
                    note: { type: "string" }
                  }
                }
              }
            }
          },
          "400": { description: "رموز العملات غير صالحة." },
          "401": { description: "مفتاح API مفقود أو غير صالح أو ملغى." },
          "422": { description: "رمز العملة غير مدعوم أو لا يتوفر له سعر." },
          "429": { description: "تجاوز حد 30 طلبًا في الدقيقة لكل مفتاح." },
          "502": { description: "مصدر أسعار العملات غير متاح." },
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
        bearerFormat: "Nox Apis API Key",
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
