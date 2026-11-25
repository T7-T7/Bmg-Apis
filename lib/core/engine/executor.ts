import { randomUUID } from "node:crypto";

export type ExecutionService = Readonly<{
  slug: string;
  method: string;
}>;

export type ExecutionContext = Readonly<{
  requestId: string;
  serviceSlug: string;
  startedAt: number;
}>;

type ExecutionOptions = Readonly<{
  service: ExecutionService;
  request: Request;
  handler: (context: ExecutionContext) => Promise<Response>;
  managerName: string;
  onMethodNotAllowed: (requestId: string) => Response;
  onFailure: (requestId: string, durationMs: number, cause: unknown) => Response;
}>;

function withExecutionHeaders(
  response: Response,
  context: ExecutionContext,
  managerName: string,
): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-Id", context.requestId);
  headers.set("X-Service-Manager", managerName);
  headers.set("X-Service-Slug", context.serviceSlug);
  headers.set("Server-Timing", `service-execution;dur=${Math.max(0, Date.now() - context.startedAt)}`);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Shared request lifecycle for registered Nox services.
 * Authentication, authorization, validation and usage policies remain owned
 * by their existing domain modules until they are migrated into core managers.
 */
export async function executeRequestPipeline({
  service,
  request,
  handler,
  managerName,
  onMethodNotAllowed,
  onFailure,
}: ExecutionOptions): Promise<Response> {
  const requestId = randomUUID();

  if (request.method !== service.method) {
    return onMethodNotAllowed(requestId);
  }

  const context: ExecutionContext = Object.freeze({
    requestId,
    serviceSlug: service.slug,
    startedAt: Date.now(),
  });

  try {
    return withExecutionHeaders(await handler(context), context, managerName);
  } catch (cause) {
    return onFailure(requestId, Date.now() - context.startedAt, cause);
  }
}
