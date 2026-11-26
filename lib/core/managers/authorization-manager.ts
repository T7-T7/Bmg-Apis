export type AuthorizationRpcResult = Readonly<{
  authorized: boolean;
  reason?: string;
  usageId: number | null;
  message?: string;
}>;

type RpcResponse = Readonly<{ data: unknown; error: unknown }>;

type ManagedAuthorizationOptions = Readonly<{
  rpc: (procedure: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
  serviceSlug: string;
  token: string | null;
  clientHash: () => string;
  serverSecret: string | undefined;
}>;

/**
 * Nox Core owns the shared Supabase authorization RPC boundary.
 * Service routes remain responsible for translating denial reasons into
 * their existing public HTTP response contracts.
 */
export async function authorizeManagedRequest({
  rpc,
  serviceSlug,
  token,
  clientHash,
  serverSecret,
}: ManagedAuthorizationOptions): Promise<AuthorizationRpcResult> {
  const isApiKeyRequest = Boolean(token);
  const procedure = isApiKeyRequest
    ? "bmg_authorize_api_request"
    : "bmg_authorize_demo_request";
  const args = isApiKeyRequest
    ? {
        p_key: token,
        p_service_slug: serviceSlug,
        p_method: "POST",
        p_server_secret: serverSecret,
      }
    : {
        p_client_hash: clientHash(),
        p_service_slug: serviceSlug,
        p_method: "POST",
        p_server_secret: serverSecret,
      };

  const { data, error } = await rpc(procedure, args);
  if (error) throw error;

  const result =
    data !== null && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;

  return Object.freeze({
    authorized: result?.authorized === true,
    reason: typeof result?.reason === "string" ? result.reason : undefined,
    usageId: Number(result?.usage_id) || null,
    message: typeof result?.message === "string" ? result.message : undefined,
  });
}
