import type { ManagedSupabaseRpc } from "./supabase-rpc-manager";

export type UsageCompletion = Readonly<{
  usageId: number | null;
  complete: () => Promise<unknown>;
  onError: (cause: unknown) => void;
}>;

const COMPLETION_ATTEMPTS = 3;

export async function completeUsageTracking({
  usageId,
  complete,
  onError,
}: UsageCompletion): Promise<void> {
  if (!usageId) return;

  let lastError: unknown;
  for (let attempt = 0; attempt < COMPLETION_ATTEMPTS; attempt += 1) {
    try {
      const result = await complete();
      if (
        result === null ||
        typeof result !== "object" ||
        !("completed" in result) ||
        result.completed !== true
      ) {
        const reason =
          result !== null && typeof result === "object" && "reason" in result
            ? String(result.reason)
            : "invalid_acknowledgement";
        throw new Error(`Usage completion was not confirmed: ${reason}`);
      }
      return;
    } catch (cause) {
      lastError = cause;
      if (attempt + 1 < COMPLETION_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
      }
    }
  }

  onError(lastError);
}

export type ManagedUsageCompletion = Readonly<{
  usageId: number | null;
  statusCode: number;
  startedAt: number;
  serverSecret: string | undefined;
  rpc: ManagedSupabaseRpc;
  onError: (cause: unknown) => void;
}>;

/**
 * Nox Core owns the completion RPC contract and retry policy.
 * Service adapters provide only their database transport and keep their
 * existing response/error behavior unchanged.
 */
export async function completeManagedUsageTracking({
  usageId,
  statusCode,
  startedAt,
  serverSecret,
  rpc,
  onError,
}: ManagedUsageCompletion): Promise<void> {
  return completeUsageTracking({
    usageId,
    complete: async () => {
      const { data, error } = await rpc("bmg_complete_api_request", {
        p_usage_id: usageId as number,
        p_status_code: statusCode,
        p_latency_ms: Math.max(0, Date.now() - startedAt),
        p_server_secret: serverSecret,
      });
      if (error) throw error;
      return data;
    },
    onError,
  });
}
