import type { AdminCommandRole } from "./command-types";

export const ADMIN_COMMANDS = Object.freeze({
  "profile.update": Object.freeze({ permission: "admin", handler: "updateProfile" }),
  "profile.grant_admin": Object.freeze({ permission: "owner", handler: "updateProfile" }),
  "service.create": Object.freeze({ permission: "admin", handler: "saveService" }),
  "service.update": Object.freeze({ permission: "admin", handler: "saveService" }),
  "service.archive": Object.freeze({ permission: "admin", handler: "archiveService" }),
  "service.restore": Object.freeze({ permission: "admin", handler: "archiveService" }),
  "service.rollback": Object.freeze({ permission: "admin", handler: "rollbackServiceVersion" }),
  "api_key.update": Object.freeze({ permission: "admin", handler: "updateApiKey" }),
  "api_key.delete": Object.freeze({ permission: "admin", handler: "deleteApiKey" }),
  "plan_limits.update": Object.freeze({ permission: "admin", handler: "savePlanLimits" }),
  "admin_limits.update": Object.freeze({ permission: "admin", handler: "saveAdminLimits" }),
  "notification.broadcast": Object.freeze({ permission: "admin", handler: "sendNotification" }),
  "incident.create": Object.freeze({ permission: "admin", handler: "createIncident" }),
  "incident.update": Object.freeze({ permission: "admin", handler: "updateIncident" }),
  "incident.status_change": Object.freeze({ permission: "admin", handler: "changeIncidentStatus" }),
  "service_dependency.create": Object.freeze({ permission: "admin", handler: "createServiceDependency" }),
  "service_dependency.delete": Object.freeze({ permission: "admin", handler: "deleteServiceDependency" }),
  "maintenance.configure": Object.freeze({ permission: "admin", handler: "configureMaintenance" }),
  "maintenance.toggle": Object.freeze({ permission: "admin", handler: "toggleMaintenance" }),
} satisfies Record<string, Readonly<{ permission: AdminCommandRole; handler: string }>>);

export type AdminCommandName = keyof typeof ADMIN_COMMANDS;
export type AdminCommandDefinition = (typeof ADMIN_COMMANDS)[AdminCommandName];

export function getAdminCommand(name: string): AdminCommandDefinition | null {
  if (!Object.prototype.hasOwnProperty.call(ADMIN_COMMANDS, name)) return null;
  return ADMIN_COMMANDS[name as AdminCommandName];
}

export function listAdminCommands(): readonly Readonly<{
  name: AdminCommandName;
  permission: AdminCommandRole;
  handler: string;
}>[] {
  return Object.freeze(
    (Object.keys(ADMIN_COMMANDS) as AdminCommandName[]).map((name) =>
      Object.freeze({ name, ...ADMIN_COMMANDS[name] }),
    ),
  );
}
