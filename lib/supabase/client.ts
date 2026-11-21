"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

let client: SupabaseClient<Database> | null = null;
export function getSupabaseBrowserClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("إعدادات Supabase العامة غير موجودة في بيئة النشر.");
  client = createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
