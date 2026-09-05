import type { InviteErrorCode } from "@/types";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input") {
    super("validation", 400, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Not allowed") {
    super("forbidden", 403, message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("not_found", 404, message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super("conflict", 409, message);
  }
}

/** A downstream dependency (e.g. the email provider) failed — distinct from
 * ValidationError so callers can tell "your input was wrong" apart from
 * "we couldn't complete the action right now, try again". */
export class EmailSendError extends AppError {
  constructor(message = "Couldn't send the email") {
    super("email_send", 502, message);
  }
}

export class InviteError extends AppError {
  readonly inviteCode: InviteErrorCode;
  constructor(inviteCode: InviteErrorCode, message = inviteCode) {
    super("invite", 409, message);
    this.inviteCode = inviteCode;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
