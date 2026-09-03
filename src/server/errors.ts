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

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
