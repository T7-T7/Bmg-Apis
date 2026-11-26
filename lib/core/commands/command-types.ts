export type AdminCommandRole = "admin" | "owner";

export type AdminCommandActor = Readonly<{
  id: string;
  role: AdminCommandRole;
}>;

export type AdminCommandContext = Readonly<{
  actor: AdminCommandActor;
  request: Request;
}>;

export type AdminCommandHandler = (
  input: unknown,
  context: AdminCommandContext,
) => Promise<unknown>;

export type AdminCommandFailureCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "UNKNOWN_COMMAND"
  | "HANDLER_UNAVAILABLE";

export class AdminCommandError extends Error {
  readonly code: AdminCommandFailureCode;
  readonly status: 401 | 403 | 404 | 503;

  constructor(
    code: AdminCommandFailureCode,
    message: string,
    status: 401 | 403 | 404 | 503,
  ) {
    super(message);
    this.name = "AdminCommandError";
    this.code = code;
    this.status = status;
  }
}

export class AdminCommandInputError extends Error {
  readonly code = "INVALID_INPUT" as const;
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = "AdminCommandInputError";
  }
}
