import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AdminCommandActor, AdminCommandHandler } from "./command-types";

type AdminRole = "admin" | "owner";
function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("بيانات الأمر يجب أن تكون كائناً صالحاً.");
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`الحقل ${field} مطلوب.`);
  return value.trim();
}
function uuid(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new Error(`قيمة ${field} ليست UUID صالحاً.`);
  return result;
}
function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`قيمة ${field} يجب أن تكون تاريخاً صالحاً أو null.`);
  return new Date(value).toISOString();
}
function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`قيمة ${field} غير مسموح بها.`);
  return value as T;
}

export async function createAdminCommandRuntime(): Promise<{
  authorize: (request: Request) => Promise<AdminCommandActor | null>;
  handlers: Readonly<Record<string, AdminCommandHandler>>;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("إعدادات Supabase غير مكتملة.");

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Read-only context. */ }
      },
    },
  }) as SupabaseClient<Database>;

  const authorize = async (_request: Request): Promise<AdminCommandActor | null> => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profileError || !profile || (profile.role !== "admin" && profile.role !== "owner")) return null;
    return Object.freeze({ id: userData.user.id, role: profile.role as AdminRole });
  };

  const updateProfile: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const userId = uuid(input.userId, "userId");
    const role = enumValue(input.role, ["user", "admin"] as const, "role");
    const plan = enumValue(input.plan, ["basic", "pro", "premium"] as const, "plan");
    const planExpiresAt = optionalIsoDate(input.planExpiresAt, "planExpiresAt");
    const accountStatus = enumValue(input.accountStatus, ["active", "suspended"] as const, "accountStatus");
    const { data, error } = await supabase.rpc("bmg_admin_update_profile", {
      p_user_id: userId, p_role: role, p_plan: plan,
      p_plan_expires_at: planExpiresAt, p_account_status: accountStatus,
    });
    if (error) throw new Error(error.message);
    if (data !== true) throw new Error("لم يتم تحديث الحساب.");
    return { updated: true, userId };
  };

  const saveAdminKey: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const id = uuid(input.id, "id");
    const label = requiredString(input.label, "label");
    const expiresAt = optionalIsoDate(input.expiresAt, "expiresAt");
    if (!Array.isArray(input.scopes)) throw new Error("قائمة صلاحيات المفتاح غير صالحة.");
    const scopes = [...new Set(input.scopes.map((scope) => requiredString(scope, "scopes")))];
    if (!scopes.includes("api:use")) scopes.unshift("api:use");
    if (scopes.length > 32) throw new Error("عدد صلاحيات المفتاح يتجاوز الحد المسموح.");
    const { data, error } = await supabase.rpc("bmg_admin_update_api_key", {
      p_id: id, p_label: label, p_expires_at: expiresAt, p_scopes: scopes,
    });
    if (error) throw new Error(error.message);
    if (data !== true) throw new Error("المفتاح غير موجود أو لا يمكن تحديثه.");
    return { updated: true, keyId: id };
  };

  const deleteAdminKey: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const id = uuid(input.id, "id");
    const { data, error } = await supabase.rpc("bmg_admin_revoke_api_key", { p_id: id });
    if (error) throw new Error(error.message);
    if (data !== true) throw new Error("المفتاح غير موجود أو تم إلغاؤه مسبقاً.");
    return { revoked: true, keyId: id };
  };

  return { authorize, handlers: Object.freeze({ updateProfile, saveAdminKey, deleteAdminKey }) };
}
