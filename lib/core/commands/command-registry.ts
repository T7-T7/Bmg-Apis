import type { AdminCommandRole } from "./command-types";
type CommandState = "active" | "planned";
type CommandDefinition = Readonly<{ permission: AdminCommandRole; handler: string; state: CommandState }>;
const active = (permission: AdminCommandRole, handler: string): CommandDefinition => Object.freeze({ permission, handler, state: "active" });
const planned = (permission: AdminCommandRole, handler: string): CommandDefinition => Object.freeze({ permission, handler, state: "planned" });

export const ADMIN_COMMANDS = Object.freeze({
  "profile.update": active("admin", "updateProfile"),
  "profile.grant_admin": active("owner", "updateProfile"),
  "service.create": planned("admin", "saveService"),
  "service.update": planned("admin", "saveService"),
  "service.archive": active("admin", "setServiceArchived"),
  "service.restore": active("admin", "setServiceArchived"),
  "service.versions.list": active("admin", "listServiceVersions"),
  "service.rollback": active("admin", "rollbackServiceVersion"),
  "api_key.update": active("admin", "saveAdminKey"),
  "api_key.delete": active("admin", "deleteAdminKey"),
  "plan_limits.update": active("admin", "updatePlanLimits"),
  "admin_limits.update": active("admin", "updateAdminLimits"),
  "notification.broadcast": planned("admin", "sendNotification"),
  "incident.create": active("admin", "createIncident"),
  "incident.update": active("admin", "addIncidentUpdate"),
  "incident.status_change": active("admin", "changeIncident"),
  "service_dependency.create": active("admin", "saveDependency"),
  "service_dependency.delete": active("admin", "deleteDependency"),
  "maintenance.configure": active("admin", "configureMaintenance"),
  "maintenance.toggle": active("admin", "setMaintenanceEnabled"),
} satisfies Record<string, CommandDefinition>);

export type AdminCommandName = keyof typeof ADMIN_COMMANDS;
export type AdminCommandDefinition = (typeof ADMIN_COMMANDS)[AdminCommandName];
export function getAdminCommand(name: string): AdminCommandDefinition | null {
  if (!Object.prototype.hasOwnProperty.call(ADMIN_COMMANDS, name)) return null;
  return ADMIN_COMMANDS[name as AdminCommandName];
}
export function listAdminCommands(): readonly Readonly<{name: AdminCommandName; permission: AdminCommandRole; handler: string; state: CommandState}>[] {
  return Object.freeze((Object.keys(ADMIN_COMMANDS) as AdminCommandName[]).map((name) => Object.freeze({ name, ...ADMIN_COMMANDS[name] })));
}
