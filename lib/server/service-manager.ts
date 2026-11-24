/**
 * NOX Service Manager
 *
 * Central server-side registry and execution boundary for API services.
 * Service implementations remain in private server modules; this file only
 * exposes public metadata and controlled dispatch.
 */

export type ServiceCategory = "ai" | "image" | "search" | "media" | "utility";

export type ServiceDefinition = Readonly<{
  slug: string;
  name: string;
  category: ServiceCategory;
  method: "POST";
  path: string;
  version: string;
  enabled: boolean;
  timeoutMs: number;
}>;

export const SERVICE_REGISTRY: readonly ServiceDefinition[] = Object.freeze([
  Object.freeze({
    slug: "aql-gemini",
    name: "Gemini",
    category: "ai",
    method: "POST",
    path: "/api/v1/ai/gemini",
    version: "1.0.0",
    enabled: true,
    timeoutMs: 55_000,
  }),
  Object.freeze({
    slug: "gptfree",
    name: "GPTFree",
    category: "ai",
    method: "POST",
    path: "/api/v1/ai/gptfree",
    version: "1.0.0",
    enabled: true,
    timeoutMs: 110_000,
  }),
]);

const registryBySlug = new Map(SERVICE_REGISTRY.map((service) => [service.slug, service]));

export class ServiceUnavailableError extends Error {
  readonly code = "SERVICE_UNAVAILABLE";

  constructor(message = "الخدمة غير متاحة حاليًا.") {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

/** Returns a safe, public-only view of registered services. */
export function listServices(): ServiceDefinition[] {
  return SERVICE_REGISTRY
    .filter((service) => service.enabled)
    .map((service) => ({ ...service }));
}

/** Resolves a service without exposing its implementation or source path. */
export function getService(slug: string): ServiceDefinition {
  const service = registryBySlug.get(slug);
  if (!service || !service.enabled) {
    throw new ServiceUnavailableError();
  }
  return service;
}

/**
 * The only supported execution entry point for registered services.
 * The executor is supplied by trusted server-side route code, never by a
 * request body, database record, or browser-provided module name.
 */
export async function executeService<T>(
  slug: string,
  executor: () => Promise<T>,
): Promise<T> {
  getService(slug);

  try {
    return await executor();
  } catch (cause) {
    // Keep the original cause for server-side logging while allowing routes
    // to decide their own stable HTTP response.
    throw cause;
  }
}
