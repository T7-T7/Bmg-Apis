import { createClient } from "@supabase/supabase-js";

export type ManagedSupabaseRpc = (
  procedure: string,
  args: Record<string, unknown>,
) => PromiseLike<Readonly<{ data: unknown; error: unknown }>>;

/**
 * Nox Core owns the Supabase RPC transport configuration.
 * Create one request-scoped transport and share it between authorization
 * and usage completion; never retain a client across requests.
 */
export function createManagedSupabaseRpc(): ManagedSupabaseRpc {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return async (procedure, args) => {
    const { data, error } = await client.rpc(procedure, args as never);
    return { data, error };
  };
}
