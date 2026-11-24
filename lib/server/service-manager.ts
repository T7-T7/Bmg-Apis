import { randomUUID } from "node:crypto";

export type ManagedServiceSlug = "aql-gemini" | "gptfree";

export type ManagedServiceDefinition = Readonly<{
  slug: ManagedServiceSlug;
  method: "POST";
  runtime: "nodejs";
  maxDuration: number;
  route: string;
}>;

/**
 * Handlers are registered at build time and remain server-side.
 * Supabase remains authoritative for availability, maintenance, API-key scopes,
 * quotas and usage authorization inside each service handler.
 */
export const SERVICE_REGISTRY: Readonly<Record<ManagedServiceSlug, ManagedServiceDefinition>> =
  Object.freeze({
    "aql-gemini": Object.freeze({
      slug: "aql-gemini",
      method: "POST",
      runtime: "nodejs",
      maxDuration: 60,
      route: "/api/v1/ai/gemini",
    }),
    gptfree: Object.freeze({
      slug: "gptfree",
      method: "POST",
      runtime: "nodejs",
      maxDuration: 120,
      route: "/api/v1/ai/gptfree",
    }),
  });

export function getManagedService(slug: string): ManagedServiceDefinition | null {
  if (!Object.prototype.hasOwnProperty.call(SERVICE_REGISTRY, slug)) return null;
  return SERVICE_REGISTRY[slug as ManagedServiceSlug];
}

function managerError(message: string, status: number, requestId: string) {
  return Response.json(
    { success: false, error: message, code: status === 404 ? "SERVICE_NOT_FOUND" : "SERVICE_MANAGER_ERROR", requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        "X-Service-Manager": "Bmg-Apis",
      },
    },
  );
}

/** One server-side execution boundary for every registered API service. */
export async function executeManagedService(
  slug: ManagedServiceSlug,
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const requestId = randomUUID();
  const service = getManagedService(slug);

  if (!service) return managerError("الخدمة المطلوبة غير مسجلة.", 404, requestId);
  if (request.method !== service.method) {
    return managerError("طريقة الطلب غير مدعومة لهذه الخدمة.", 405, requestId);
  }

  const startedAt = Date.now();
  try {
    const response = await handler();
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Request-Id", requestId);
    headers.set("X-Service-Manager", "Bmg-Apis");
    headers.set("X-Service-Slug", service.slug);
    headers.set("Server-Timing", `service-manager;dur=${Date.now() - startedAt}`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (cause) {
    console.error("[Bmg Service Manager]", {
      service: service.slug,
      requestId,
      durationMs: Date.now() - startedAt,
      error: cause instanceof Error ? cause.message : "Unknown service failure",
    });
    return managerError("تعذر تنفيذ الخدمة حاليًا.", 500, requestId);
  }
}
