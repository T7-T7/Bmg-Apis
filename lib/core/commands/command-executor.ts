import { randomUUID } from "node:crypto";
import { getAdminCommand, type AdminCommandName } from "./command-registry";
import {
  AdminCommandError,
  type AdminCommandActor,
  type AdminCommandHandler,
} from "./command-types";

export type AdminCommandDependencies = Readonly<{
  /**
   * Must derive the actor from the request's verified server-side session.
   * Never implement this using a role, user ID, or permission sent by the client.
   */
  authorize: (request: Request) => Promise<AdminCommandActor | null>;
  /** Server-owned handlers only; never construct this map from request data. */
  handlers: Readonly<Record<string, AdminCommandHandler | undefined>>;
}>;

export type ExecuteAdminCommandInput = Readonly<{
  request: Request;
  command: string;
  input: unknown;
}>;

export type ExecuteAdminCommandResult = Readonly<{
  command: AdminCommandName;
  requestId: string;
  result: unknown;
}>;

/**
 * Dispatches a registered administrative command after resolving the actor
 * from a trusted server-side authorization adapter.
 */
export async function executeAdminCommand(
  input: ExecuteAdminCommandInput,
  dependencies: AdminCommandDependencies,
): Promise<ExecuteAdminCommandResult> {
  const requestId = randomUUID();
  const definition = getAdminCommand(input.command);

  if (!definition) {
    throw new AdminCommandError("UNKNOWN_COMMAND", "الأمر الإداري غير مسجل.", 404);
  }

  const actor = await dependencies.authorize(input.request);
  if (!actor) {
    throw new AdminCommandError("UNAUTHENTICATED", "يلزم تسجيل الدخول.", 401);
  }

  if (actor.role !== "admin" && actor.role !== "owner") {
    throw new AdminCommandError("FORBIDDEN", "لا تملك صلاحية تنفيذ الأوامر الإدارية.", 403);
  }

  if (definition.permission === "owner" && actor.role !== "owner") {
    throw new AdminCommandError("FORBIDDEN", "هذا الأمر متاح لمالك المنصة فقط.", 403);
  }

  const handler = dependencies.handlers[definition.handler];
  if (!handler) {
    throw new AdminCommandError("HANDLER_UNAVAILABLE", "معالج الأمر غير متاح.", 503);
  }

  const result = await handler(input.input, {
    actor: Object.freeze({ id: actor.id, role: actor.role }),
    request: input.request,
  });

  return Object.freeze({ command: input.command as AdminCommandName, requestId, result });
}
