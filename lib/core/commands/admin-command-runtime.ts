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
      p_plan_expires_at: planExpiresAt as string, p_account_status: accountStatus,
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
      p_id: id, p_label: label, p_expires_at: expiresAt as string, p_scopes: scopes,
    });
    if (error) throw new Error(error.message);
    if (data !== true) throw new Error("المفتاح غير موجود أو لا يمكن تحديثه.");
    return { updated: true, keyId: id };
  };

  const deleteAdminKey: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const id = uuid(input.id, "id");
    const { data, error } = await supabase.rpc("bmg_admin_delete_api_key", { p_id: id });
    if (error) throw new Error(error.message);
    if (data !== true) throw new Error("المفتاح غير موجود أو تم إلغاؤه مسبقاً.");
    return { revoked: true, keyId: id };
  };

  const listServiceVersions: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const serviceId = uuid(input.serviceId, "serviceId");
    const { data, error } = await supabase.rpc("bmg_admin_get_service_versions", {
      p_service_id: serviceId,
    });
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("تعذر قراءة سجل إصدارات الخدمة.");
    return data;
  };

  const rollbackServiceVersion: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const serviceId = uuid(input.serviceId, "serviceId");
    if (!Number.isSafeInteger(input.version) || Number(input.version) < 1) {
      throw new Error("رقم إصدار الخدمة غير صالح.");
    }
    const { data, error } = await supabase.rpc("bmg_admin_rollback_api_service", {
      p_service_id: serviceId,
      p_version: Number(input.version),
    });
    if (error) throw new Error(error.message);
    if (!Number.isSafeInteger(data) || Number(data) < 1) {
      throw new Error("لم يتم استرجاع إصدار الخدمة.");
    }
    return { version: Number(data), serviceId };
  };

  const setServiceArchived: AdminCommandHandler = async (value, context) => {
    const input = objectInput(value);
    const serviceId = uuid(input.serviceId, "serviceId");
    if (typeof input.archived !== "boolean") throw new Error("حالة الأرشفة يجب أن تكون true أو false.");
    if (context.actor.role !== "admin") {
      throw new Error("تغيير حالة الخدمات متاح لحسابات الإدارة المصرح لها من قاعدة البيانات.");
    }
    const archivedAt = input.archived ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from("api_services")
      .update({ archived_at: archivedAt, updated_at: new Date().toISOString() })
      .eq("id", serviceId)
      .select("id,slug,archived_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("الخدمة غير موجودة أو لا تملك صلاحية تعديلها.");
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: context.actor.id,
      action: input.archived ? "service.archive" : "service.restore",
      entity_type: "api_service",
      entity_id: serviceId,
      details: { slug: data.slug, archived_at: data.archived_at },
    });
    if (auditError) throw new Error(auditError.message);
    return { serviceId, slug: data.slug, archived: data.archived_at !== null };
  };

  const saveDependency: AdminCommandHandler = async (value, context) => {
    const input = objectInput(value);
    if (context.actor.role !== "admin") throw new Error("إدارة اعتماديات الخدمات متاحة لحسابات الإدارة المصرح لها من قاعدة البيانات.");
    const serviceId = uuid(input.service_id, "service_id");
    const dependsOnServiceId = uuid(input.depends_on_service_id, "depends_on_service_id");
    if (serviceId === dependsOnServiceId) throw new Error("لا يمكن للخدمة الاعتماد على نفسها.");
    const dependencyType = enumValue(input.dependency_type, ["required", "optional"] as const, "dependency_type");
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (description.length > 1000) throw new Error("وصف الاعتمادية يتجاوز 1000 حرف.");
    const { data, error } = await supabase.from("api_service_dependencies").insert({
      service_id: serviceId, depends_on_service_id: dependsOnServiceId,
      dependency_type: dependencyType, description, created_by: context.actor.id,
    }).select("id,service_id,depends_on_service_id,dependency_type").single();
    if (error) throw new Error(error.message);
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: context.actor.id, action: "service_dependency.create",
      entity_type: "api_service_dependency", entity_id: data.id,
      details: { service_id: data.service_id, depends_on_service_id: data.depends_on_service_id, dependency_type: data.dependency_type },
    });
    if (auditError) throw new Error(auditError.message);
    return data;
  };

  const deleteDependency: AdminCommandHandler = async (value, context) => {
    const input = objectInput(value);
    if (context.actor.role !== "admin") throw new Error("إدارة اعتماديات الخدمات متاحة لحسابات الإدارة المصرح لها من قاعدة البيانات.");
    const dependencyId = uuid(input.id, "id");
    const { data, error } = await supabase.from("api_service_dependencies")
      .delete().eq("id", dependencyId)
      .select("id,service_id,depends_on_service_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("الاعتمادية غير موجودة أو لا تملك صلاحية حذفها.");
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: context.actor.id, action: "service_dependency.delete",
      entity_type: "api_service_dependency", entity_id: data.id,
      details: { service_id: data.service_id, depends_on_service_id: data.depends_on_service_id },
    });
    if (auditError) throw new Error(auditError.message);
    return { deleted: true, id: data.id };
  };

  const configureMaintenance: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const serviceId = input.service_id === null || input.service_id === "" || input.service_id === undefined
      ? null : uuid(input.service_id, "service_id");
    if (typeof input.message !== "string") throw new Error("رسالة الصيانة يجب أن تكون نصاً.");
    if (typeof input.enabled !== "boolean") throw new Error("حالة الصيانة يجب أن تكون true أو false.");
    const startsAt = optionalIsoDate(input.starts_at, "starts_at");
    const endsAt = optionalIsoDate(input.ends_at, "ends_at");
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      throw new Error("وقت نهاية الصيانة يجب أن يكون بعد وقت البداية.");
    }
    const { data, error } = await supabase.rpc("bmg_admin_configure_maintenance", {
      p_service_id: serviceId,
      p_message: input.message,
      p_enabled: input.enabled,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
      throw new Error("لم يتم حفظ إعداد الصيانة.");
    }
    return data;
  };

  const setMaintenanceEnabled: AdminCommandHandler = async (value, context) => {
    const input = objectInput(value);
    const maintenanceId = uuid(input.id, "id");
    if (typeof input.enabled !== "boolean") throw new Error("حالة الصيانة يجب أن تكون true أو false.");
    const { data, error } = await supabase.from("maintenance_windows")
      .update({ enabled: input.enabled, updated_at: new Date().toISOString(), updated_by: context.actor.id })
      .eq("id", maintenanceId)
      .select("id,service_id,enabled")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("نافذة الصيانة غير موجودة أو لا تملك صلاحية تعديلها.");
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: context.actor.id,
      action: "maintenance.toggle",
      entity_type: "maintenance_window",
      entity_id: data.id,
      details: { service_id: data.service_id, enabled: data.enabled },
    });
    if (auditError) throw new Error(auditError.message);
    return data;
  };

  return {
    authorize,
    handlers: Object.freeze({
      updateProfile, saveAdminKey, deleteAdminKey,
      listServiceVersions, rollbackServiceVersion, setServiceArchived,
      saveDependency, deleteDependency, configureMaintenance, setMaintenanceEnabled,
    }),
  };
}
