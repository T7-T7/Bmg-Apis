import type { AuthorizationRpcResult } from "./authorization-manager";
import { authorizeManagedRequest } from "./authorization-manager";
import { createManagedSupabaseRpc, type ManagedSupabaseRpc } from "./supabase-rpc-manager";

export type ManagedServiceAccess = Readonly<{
  rpc: ManagedSupabaseRpc;
  authorization: AuthorizationRpcResult;
}>;

type ManagedServiceAccessOptions = Readonly<{
  serviceSlug: string;
  token: string | null;
  clientHash: () => string;
  serverSecret: string | undefined;
}>;

/**
 * Nox Core owns the shared access bootstrap: create one request-scoped
 * Supabase RPC transport, then use it for the service authorization decision.
 * Routes retain only their service-specific public denial response mapping.
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

  return Object.freeze({ rpc, authorization });
}
