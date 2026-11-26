import type { AuthorizationRpcResult } from "./authorization-manager";
import { authorizeManagedRequest } from "./authorization-manager";
import { completeManagedUsageTracking } from "./usage-manager";
import { createManagedSupabaseRpc, type ManagedSupabaseRpc } from "./supabase-rpc-manager";

export type ManagedUsageCompletionOptions = Readonly<{
  statusCode: number;
  startedAt: number;
  onError: (cause: unknown) => void;
}>;

export type ManagedServiceAccess = Readonly<{
  rpc: ManagedSupabaseRpc;
  authorization: AuthorizationRpcResult;
  completeUsage: (options: ManagedUsageCompletionOptions) => Promise<void>;
}>;

type ManagedServiceAccessOptions = Readonly<{
  serviceSlug: string;
  token: string | null;
  clientHash: () => string;
  serverSecret: string | undefined;
}>;

/**
 * Nox Core owns the request-scoped access and usage lifecycle:
 * one RPC transport authorizes the request and completes its usage record.
 * Service routes retain their existing public denial and response contracts.
 */
export async function authorizeManagedServiceRequest({
  serviceSlug,
  token,
  clientHash,
  serverSecret,
}: ManagedServiceAccessOptions): Promise<ManagedServiceAccess> {
  const rpc = createManagedSupabaseRpc();
  const authorization = await authorizeManagedRequest({
    rpc,
    serviceSlug,
    token,
    clientHash,
    serverSecret,
  });

  return Object.freeze({
    rpc,
    authorization,
    completeUsage: ({ statusCode, startedAt, onError }) =>
      completeManagedUsageTracking({
        usageId: authorization.usageId,
        statusCode,
        startedAt,
        serverSecret,
        rpc,
        onError,
      }),
  });
}
