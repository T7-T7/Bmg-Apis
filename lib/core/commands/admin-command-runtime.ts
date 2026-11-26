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
function positiveSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`قيمة ${field} يجب أن تكون عدداً صحيحاً موجباً.`);
  return Number(value);
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
    const { data, error } = await supabase.rpc("bmg_admin_set_service_archived", {
      p_service_id: serviceId,
      p_archived: input.archived,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("لم يتم تغيير حالة أرشفة الخدمة.");
    return data as { serviceId: string; slug: string; archived: boolean };
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
    const { data, error } = await supabase.rpc("bmg_admin_create_service_dependency", {
      p_service_id: serviceId,
      p_depends_on_service_id: dependsOnServiceId,
      p_dependency_type: dependencyType,
      p_description: description,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("لم يتم إنشاء الاعتمادية.");
    return data;
  };

  const deleteDependency: AdminCommandHandler = async (value, context) => {
    const input = objectInput(value);
    if (context.actor.role !== "admin") throw new Error("إدارة اعتماديات الخدمات متاحة لحسابات الإدارة المصرح لها من قاعدة البيانات.");
    const dependencyId = uuid(input.id, "id");
    const { data, error } = await supabase.rpc("bmg_admin_delete_service_dependency", {
      p_id: dependencyId,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("لم يتم حذف الاعتمادية.");
    return data as { deleted: boolean; id: string };
  };

  const broadcastNotification: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const userId = input.user_id === null || input.user_id === "" || input.user_id === "all" || input.user_id === undefined
      ? null : uuid(input.user_id, "user_id");
    const title = requiredString(input.title, "title");
    const body = typeof input.body === "string" ? input.body : "";
    if (title.length > 200 || body.length > 5000) throw new Error("بيانات الإشعار تتجاوز الحدود المسموحة.");
    const type = enumValue(input.type, ["info", "warning", "critical"] as const, "type");
    const { data, error } = await supabase.rpc("bmg_admin_broadcast_notification", {
      p_user_id: userId, p_title: title, p_body: body, p_type: type,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        !Number.isSafeInteger((data as Record<string, unknown>).recipient_count)) {
      throw new Error("لم يتم إرسال الإشعار.");
    }
    return data;
  };

  const parseServiceInput = (value: unknown) => {
    const input = objectInput(value);
    const slug = requiredString(input.slug, "slug");
    const name = requiredString(input.name, "name");
    const description = typeof input.description === "string" ? input.description : "";
    const category = requiredString(input.category, "category");
    const endpointPath = requiredString(input.endpoint_path, "endpoint_path");
    const docsMarkdown = typeof input.docs_markdown === "string" ? input.docs_markdown : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) throw new Error("معرّف الخدمة غير صالح.");
    if (name.length > 120 || description.length > 10000 || category.length > 80 ||
        !endpointPath.startsWith("/") || endpointPath.length > 500 || docsMarkdown.length > 50000) {
      throw new Error("بيانات الخدمة تتجاوز الحدود المسموحة أو أن المسار غير صالح.");
    }
    const httpMethod = enumValue(input.http_method, ["GET", "POST", "PUT", "PATCH", "DELETE"] as const, "http_method");
    const status = enumValue(input.status, ["active", "maintenance", "disabled"] as const, "status");
    const sourceType = enumValue(input.source_type, ["official", "community"] as const, "source_type");
    const weight = positiveSafeInteger(input.weight, "weight");
    if (weight > 100) throw new Error("وزن الخدمة يجب ألا يتجاوز 100.");
    return { slug, name, description, category, endpoint_path: endpointPath, http_method: httpMethod,
      docs_markdown: docsMarkdown, status, source_type: sourceType, weight };
  };

  const createService: AdminCommandHandler = async (value) => {
    const payload = parseServiceInput(value);
    const { data, error } = await supabase.rpc("bmg_admin_create_api_service", {
      p_slug: payload.slug, p_name: payload.name, p_description: payload.description,
      p_category: payload.category, p_endpoint_path: payload.endpoint_path, p_http_method: payload.http_method,
      p_docs_markdown: payload.docs_markdown, p_status: payload.status, p_source_type: payload.source_type,
      p_weight: payload.weight,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
      throw new Error("لم يتم إنشاء الخدمة.");
    }
    return data;
  };

  const updateService: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const serviceId = uuid(input.serviceId, "serviceId");
    const payload = parseServiceInput(input);
    const { data, error } = await supabase.rpc("bmg_admin_update_api_service", {
      p_service_id: serviceId, p_slug: payload.slug, p_name: payload.name, p_description: payload.description,
      p_category: payload.category, p_endpoint_path: payload.endpoint_path, p_http_method: payload.http_method,
      p_docs_markdown: payload.docs_markdown, p_status: payload.status, p_source_type: payload.source_type,
      p_weight: payload.weight,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
      throw new Error("لم يتم تحديث الخدمة.");
    }
    return data;
  };

  const updatePlanLimits: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const plan = enumValue(input.plan, ["basic", "pro", "premium"] as const, "plan");
    const requestsPerMinute = positiveSafeInteger(input.requests_per_minute, "requests_per_minute");
    const maxApiKeys = positiveSafeInteger(input.max_api_keys, "max_api_keys");
    const dailyWeightedLimit = positiveSafeInteger(input.daily_weighted_limit, "daily_weighted_limit");
    const monthlyWeightedLimit = positiveSafeInteger(input.monthly_weighted_limit, "monthly_weighted_limit");
    const { data, error } = await supabase.rpc("bmg_admin_update_plan_limits", {
      p_plan: plan, p_requests_per_minute: requestsPerMinute, p_max_api_keys: maxApiKeys,
      p_daily_weighted_limit: dailyWeightedLimit, p_monthly_weighted_limit: monthlyWeightedLimit,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).plan !== plan) {
      throw new Error("لم يتم حفظ حدود المستوى.");
    }
    return data;
  };

  const updateAdminLimits: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const requestsPerMinute = positiveSafeInteger(input.requests_per_minute, "requests_per_minute");
    const maxApiKeys = positiveSafeInteger(input.max_api_keys, "max_api_keys");
    const dailyWeightedLimit = positiveSafeInteger(input.daily_weighted_limit, "daily_weighted_limit");
    const monthlyWeightedLimit = positiveSafeInteger(input.monthly_weighted_limit, "monthly_weighted_limit");
    const { data, error } = await supabase.rpc("bmg_admin_update_limits", {
      p_requests_per_minute: requestsPerMinute, p_max_api_keys: maxApiKeys,
      p_daily_weighted_limit: dailyWeightedLimit, p_monthly_weighted_limit: monthlyWeightedLimit,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || (data as Record<string, unknown>).id !== true) {
      throw new Error("لم يتم حفظ حدود الإدارة.");
    }
    return data;
  };

  const createIncident: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const title = requiredString(input.title, "title");
    const description = typeof input.description === "string" ? input.description : "";
    if (title.length > 200 || description.length > 10000) throw new Error("بيانات الحادث تتجاوز الحد المسموح.");
    const severity = enumValue(input.severity, ["minor", "major", "critical"] as const, "severity");
    const status = enumValue(input.status, ["investigating", "identified", "monitoring", "resolved"] as const, "status");
    if (!Array.isArray(input.affected_services) || input.affected_services.length > 50 ||
        input.affected_services.some((item) => typeof item !== "string" || !item.trim() || item.length > 120)) {
      throw new Error("قائمة الخدمات المتأثرة غير صالحة.");
    }
    const affectedServices = [...new Set(input.affected_services.map((item) => (item as string).trim()))];
    const { data, error } = await supabase.rpc("bmg_admin_create_incident", {
      p_title: title, p_description: description, p_severity: severity,
      p_status: status, p_affected_services: affectedServices,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
      throw new Error("لم يتم تسجيل الحادث.");
    }
    return data;
  };

  const changeIncident: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const incidentId = uuid(input.incident_id, "incident_id");
    const status = enumValue(input.status, ["investigating", "identified", "monitoring", "resolved"] as const, "status");
    const message = requiredString(input.message, "message");
    if (message.length > 5000) throw new Error("تحديث الحادث يتجاوز 5000 حرف.");
    const { data, error } = await supabase.rpc("bmg_admin_change_incident_status", {
      p_incident_id: incidentId, p_status: status, p_message: message,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
      throw new Error("لم يتم تحديث حالة الحادث.");
    }
    return data;
  };

  const addIncidentUpdate: AdminCommandHandler = async (value) => {
    const input = objectInput(value);
    const incidentId = uuid(input.incident_id, "incident_id");
    const message = requiredString(input.message, "message");
    if (message.length > 5000) throw new Error("تحديث الحادث يتجاوز 5000 حرف.");
    const { data, error } = await supabase.rpc("bmg_admin_add_incident_update", {
      p_incident_id: incidentId, p_message: message,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof (data as Record<string, unknown>).id !== "string") {
      throw new Error("لم تتم إضافة تحديث الحادث.");
    }
    return data;
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
    const { data, error } = await supabase.rpc("bmg_admin_toggle_maintenance", {
      p_id: maintenanceId,
      p_enabled: input.enabled,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("لم يتم تغيير حالة الصيانة.");
    return data;
  };

  return {
    authorize,
    handlers: Object.freeze({
      updateProfile, saveAdminKey, deleteAdminKey,
      listServiceVersions, rollbackServiceVersion, setServiceArchived,
      saveDependency, deleteDependency, broadcastNotification, createService, updateService, updatePlanLimits, updateAdminLimits,
      createIncident, changeIncident, addIncidentUpdate,
      configureMaintenance, setMaintenanceEnabled,
    }),
  };
}
