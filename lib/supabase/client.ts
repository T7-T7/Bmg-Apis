"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

let client: SupabaseClient<Database> | null = null;
export function getSupabaseBrowserClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("إعدادات Supabase العامة غير موجودة في بيئة النشر.");
  client = createBrowserClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

let legacySessionMigration: Promise<void> | null = null;

export function migrateLegacySession(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (legacySessionMigration) return legacySessionMigration;

  legacySessionMigration = (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;

    let storageKey: string;
    try {
      const projectRef = new URL(url).hostname.split(".")[0];
      storageKey = `sb-${projectRef}-auth-token`;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const legacy = JSON.parse(raw) as { access_token?: unknown; refresh_token?: unknown };
      if (typeof legacy.access_token !== "string" || typeof legacy.refresh_token !== "string") return;

      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: legacy.access_token,
        refresh_token: legacy.refresh_token,
      });
      if (!error) window.localStorage.removeItem(storageKey);
    } catch {
      // Keep the legacy value if storage is unavailable or migration cannot complete.
    }
  })().finally(() => {
    legacySessionMigration = null;
  });

  return legacySessionMigration;
}
