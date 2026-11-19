export type ApiCategory = "ذكاء اصطناعي" | "وسائط" | "نصوص" | "أدوات مساعدة" | "ترفيه";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiDefinition = {
  slug: string;
  name: string;
  symbol: string;
  category: ApiCategory;
  method: HttpMethod;
  endpoint: string;
  description: string;
  status: "متاحة" | "معاينة";
  latency: "—";
  updated: string;
};

export const apiCatalog: ApiDefinition[] = [
  { slug: "aql-gemini", name: "عقل — Gemini", symbol: "ع", category: "ذكاء اصطناعي", method: "POST", endpoint: "/api/v1/ai/gemini", description: "مساعد ذكاء اصطناعي للمحادثة النصية، يدعم التعليمات واستمرار المحادثة عبر sessionId، بحد أقصى 30 ألف حرف للطلب.", status: "متاحة", latency: "—", updated: "أول خدمة فعلية" },
  { slug: "echo", name: "واجهة صدى", symbol: "E", category: "أدوات مساعدة", method: "GET", endpoint: "/api/v1/echo", description: "إرجاع الرسالة المرسلة وفحص معاملات الطلب لاختبار التكامل مع التطبيقات.", status: "معاينة", latency: "—", updated: "عينة" },
  { slug: "text-tools", name: "أدوات النصوص", symbol: "T", category: "نصوص", method: "POST", endpoint: "/api/v1/text", description: "أدوات لمعالجة النصوص وتحويل حالة الأحرف وتنظيف المحتوى وتنسيقه.", status: "معاينة", latency: "—", updated: "عينة" },
  { slug: "random", name: "بيانات عشوائية", symbol: "R", category: "أدوات مساعدة", method: "GET", endpoint: "/api/v1/random", description: "إنشاء قيم وبيانات عشوائية لاستخدامها في التطوير وبناء النماذج الأولية.", status: "معاينة", latency: "—", updated: "عينة" },
  { slug: "image-info", name: "معلومات الصور", symbol: "I", category: "وسائط", method: "POST", endpoint: "/api/v1/image/info", description: "قراءة البيانات الوصفية والخصائص الأساسية من ملف صورة يتم إرساله.", status: "معاينة", latency: "—", updated: "عينة" },
  { slug: "anime", name: "بيانات الأنمي", symbol: "A", category: "ترفيه", method: "GET", endpoint: "/api/v1/anime", description: "واجهة بيانات ترفيهية تعرض معلومات الأنمي في بنية منظمة.", status: "معاينة", latency: "—", updated: "عينة" },
  { slug: "ai-assistant", name: "المساعد الذكي", symbol: "AI", category: "ذكاء اصطناعي", method: "POST", endpoint: "/api/v1/ai", description: "نقطة اتصال مستقبلية لتوليد الردود وتنفيذ المهام اعتمادًا على التعليمات.", status: "معاينة", latency: "—", updated: "معاينة" },
];

export const categories = ["الكل", "ذكاء اصطناعي", "وسائط", "نصوص", "أدوات مساعدة", "ترفيه"] as const;
export type CatalogFilter = (typeof categories)[number];