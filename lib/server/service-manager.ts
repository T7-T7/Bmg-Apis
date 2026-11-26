import { randomUUID } from "node:crypto";
import { executeRequestPipeline } from "@/lib/core/engine/executor";
import type { ExecutionContext } from "@/lib/core/engine/executor";

export type ManagedServiceSlug = "aql-gemini" | "gptfree" | "star-x";

export type ManagedServiceDefinition = Readonly<{
  slug: ManagedServiceSlug;
  category: "ai";
  method: "POST";
  runtime: "nodejs";
  maxDuration: number;
  route: string;
  authorization: "supabase-rpc";
  capabilities: readonly ("api-key" | "demo" | "usage-tracking")[];
  upstream: string;
}>;

/**
 * Build-time manifest for server-side service handlers.
 * Add a service here only alongside its server route implementation.
 * Supabase remains authoritative for availability, maintenance, scopes,
 * quotas and usage authorization. No executable code is loaded from the DB.
 */
export const SERVICE_REGISTRY: Readonly<Record<ManagedServiceSlug, ManagedServiceDefinition>> =
  Object.freeze({
    "aql-gemini": Object.freeze({
      slug: "aql-gemini",
      category: "ai",
      method: "POST",
      runtime: "nodejs",
      maxDuration: 60,
      route: "/api/v1/ai/gemini",
      authorization: "supabase-rpc",
      capabilities: Object.freeze(["api-key", "demo", "usage-tracking"] as const),
      upstream: "Gemini",
    }),
    gptfree: Object.freeze({
      slug: "gptfree",
      category: "ai",
      method: "POST",
      runtime: "nodejs",
      maxDuration: 120,
      route: "/api/v1/ai/gptfree",
      authorization: "supabase-rpc",
      capabilities: Object.freeze(["api-key", "demo", "usage-tracking"] as const),
      upstream: "GPTFree",
    }),
    "star-x": Object.freeze({
      slug: "star-x",
      category: "ai",
      method: "POST",
      runtime: "nodejs",
      maxDuration: 180,
      route: "/api/v1/ai/star-x",
      authorization: "supabase-rpc",
      capabilities: Object.freeze(["api-key", "demo", "usage-tracking"] as const),
      upstream: "Star X (PhotoRoom AI tools)",
    }),
  });

export function getManagedService(slug: string): ManagedServiceDefinition | null {
  if (!Object.prototype.hasOwnProperty.call(SERVICE_REGISTRY, slug)) return null;
  return SERVICE_REGISTRY[slug as ManagedServiceSlug];
}

export function listManagedServices(): readonly ManagedServiceDefinition[] {
  return Object.freeze(Object.values(SERVICE_REGISTRY));
}

/**
 * The no-key demo path is reserved for browser requests originating from the
 * official website. Origin is a browser boundary, not a cryptographic identity mechanism.
 */
export function isWebsiteTestRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.NOX_SITE_ORIGIN || "https://nox.bmg-inc.web.id";
  return origin === configuredOrigin;
}

/** Shared CORS preflight response for every managed API endpoint. */
export function managedServiceOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
    },
  });
}

function managerError(
  message: string,
  status: number,
  requestId: string,
  serviceSlug?: ManagedServiceSlug,
  durationMs = 0,
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    "X-Service-Manager": "Nox Core",
    "Server-Timing": `service-execution;dur=${Math.max(0, durationMs)}`,
    "X-Content-Type-Options": "nosniff",
  });
  if (serviceSlug) headers.set("X-Service-Slug", serviceSlug);

  return Response.json(
    {
      success: false,
      error: message,
      code: status === 404 ? "SERVICE_NOT_FOUND" : status === 405 ? "METHOD_NOT_ALLOWED" : "SERVICE_MANAGER_ERROR",
      requestId,
    },
    { status, headers },
  );
}

/** Compatibility adapter: routes keep their public contract while core owns execution. */
export async function executeManagedService(
  slug: ManagedServiceSlug,
  request: Request,
  handler: (context: ExecutionContext) => Promise<Response>,
): Promise<Response> {
  const service = getManagedService(slug);
  if (!service) return managerError("الخدمة المطلوبة غير مسجلة.", 404, randomUUID());

  return executeRequestPipeline({
    service,
    request,
    handler,
    managerName: "Nox Core",
    onMethodNotAllowed: (requestId) =>
      managerError("طريقة الطلب غير مدعومة لهذه الخدمة.", 405, requestId, service.slug),
    onFailure: (requestId, durationMs, cause) => {
      console.error("[Nox Core]", {
        service: service.slug,
        requestId,
        durationMs,
        errorName: cause instanceof Error ? cause.name : "UnknownError",
      });
      return managerError("تعذر تنفيذ الخدمة حاليًا.", 500, requestId, service.slug, durationMs);
    },
  });
}
