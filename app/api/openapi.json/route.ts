import { NextResponse } from "next/server";

const specification = {
  openapi: "3.1.0",
  info: {
    title: "NEXUS OF XPERIENCE (Nox)",
    version: "1.0.0",
    termsOfService: "https://nox.bmg-inc.web.id/docs",
    description: "Nox هي مقدم خدمات API والجهة التي تدير واجهة المطورين واستقبال الطلبات والمصادقة ومفاتيح API والصلاحيات والحصص وسجل الاستخدام وتنسيق تنفيذ الخدمات. يتصل المطور بـ Nox مباشرة عبر واجهة موحدة ولا يحتاج إلى تكامل منفصل مع مزودي النماذج. قد تعتمد بعض عمليات المعالجة خلف واجهة Nox على مزودي نماذج أو تشغيل متخصصين؛ ولا يدّعي هذا التوثيق أن جميع النماذج أو أوزانها مستضافة ذاتيًا على خوادم Nox. يحتوي هذا الملف على المسارات التشغيلية الفعلية فقط. صفحات الاختبار داخل الموقع تعمل دون API Key؛ لا تضف حقلًا للمفتاح في واجهة الاختبار.",
    contact: { name: "Nox", url: "https://nox.bmg-inc.web.id/docs" },
  },
  servers: [{ url: "https://nox.bmg-inc.web.id", description: "Production" }],
  tags: [{ name: "AI", description: "واجهات الذكاء الاصطناعي" }],
  paths: {
    "/api/v1/ai/gptfree": {
      post: {
        tags: ["AI"], operationId: "generateGptFreeResponse",
        summary: "إنشاء رد باستخدام GPTFree",
        description: "تقدم Nox هذه العملية عبر واجهة API موحدة تديرها المنصة. يتولى Nox استقبال الطلب والمصادقة وتطبيق الحصص وتسجيل الاستخدام وتنسيق التنفيذ؛ وقد تعتمد المعالجة خلف الواجهة على مزود تشغيل متخصص. يرسل الطلب رسالة GPTFree ويعيد الرد النصي، ويدعم سجل محادثة history بحد أقصى 20 رسالة وحد جسم 1 MB. الطلبات الخارجية تتطلب API Key صالحًا في ترويسة Authorization: Bearer. الاستثناء الوحيد هو طلبات الاختبار من صفحات الموقع الرسمية، وتُعتمد عبر Origin الموقع دون حقل مفتاح.",
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
          "200": { description: "تم إنشاء الرد." },
          "400": { description: "طلب غير صالح." }, "401": { description: "مفتاح API المرسل غير صالح أو ملغى." }, "413": { description: "تجاوز جسم الطلب حد 1 MB." },
          "429": { description: "تجاوز حد الاستخدام." }, "502": { description: "تعذر الحصول على رد من GPTFree." },
          "503": { description: "الخدمة غير متاحة." }
        }
      }
    },
    "/api/v1/ai/star-x": {
      post: {
        tags: ["AI"], operationId: "runStarXImageTool",
        summary: "تشغيل أدوات Star X للصور",
        description: "تقدم Nox أدوات الصور من خلال واجهة API تديرها المنصة، بما يشمل استقبال الطلب والمصادقة وتطبيق الحصص وتسجيل الاستخدام وتنسيق المعالجة مع أداة التشغيل المستخدمة. التعليمات الإنجليزية فقط؛ النموذج لا يفهم العربية. الحد الأقصى لجسم الطلب 4 MB. الاستجابة الناجحة صورة ثنائية وليست JSON. الطلبات الخارجية تتطلب API Key صالحًا في ترويسة Authorization: Bearer. الاستثناء الوحيد هو طلبات الاختبار من صفحات الموقع الرسمية، وتُعتمد عبر Origin الموقع دون حقل مفتاح.",
        security: [{ NoxApiKey: [] }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", additionalProperties: false, required: ["action"],
          properties: {
            action: { type: "string", enum: ["edit-scene", "generate-image", "change-background", "improve-lighting"] },
            imageUrl: { type: "string", format: "uri", description: "HTTPS image URL; required except for generate-image." },
            prompt: { type: "string", maxLength: 4000, description: "English prompt only." }
          }
        }, example: { action: "generate-image", prompt: "A cinematic photograph of a modern glass house beside a lake at sunset" } } } },
        responses: {
          "200": { description: "Generated image binary (image/*).", content: { "image/*": { schema: { type: "string", format: "binary" } } } },
          "400": { description: "Invalid request or unsupported prompt language." },
          "403": { description: "Account restriction or insufficient service scope." },
          "413": { description: "Request body exceeds the 4 MB limit." },
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
        description: "تقدم Nox خدمة Gemini عبر واجهة API موحدة تديرها المنصة. تتولى Nox استقبال الطلب والمصادقة وتطبيق الحصص وتسجيل الاستخدام وتنسيق تنفيذ النموذج؛ وقد تعتمد المعالجة خلف الواجهة على مزود تشغيل متخصص. يعيد الطلب الرد ومعرّف جلسة يمكن تمريره في الطلب التالي لمتابعة المحادثة. الحد الأقصى لـ prompt هو 30000 حرف. حدود الاستخدام ومعدل الطلبات تُحدد بحسب الحساب والخطة والمفتاح والخدمة، ولا يوجد رقم موحد مضمون لكل الحسابات. الحد الأقصى لجسم الطلب 1 MB. الطلبات الخارجية تتطلب API Key صالحًا في ترويسة Authorization: Bearer. الاستثناء الوحيد هو طلبات الاختبار من صفحات الموقع الرسمية، وتُعتمد عبر Origin الموقع دون حقل مفتاح.",
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
        bearerFormat: "Nox API Key",
        description: "إلزامي لكل طلبات API الخارجية. الاستثناء الوحيد طلبات الاختبار من صفحات موقع Nox الرسمية؛ لا تعرض صفحات الاختبار حقل API Key. أرسل المفتاح الخارجي في Authorization: Bearer YOUR_NOX_API_KEY."
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
