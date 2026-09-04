// @vitest-environment node
import { describe, expect, it } from "vitest";

import { AppError, ConflictError, ForbiddenError, isAppError, NotFoundError, ValidationError } from "./errors";

describe("errors", () => {
  it("carries a stable code and http status", () => {
    expect(new ValidationError("x").code).toBe("validation");
    expect(new ForbiddenError("x").status).toBe(403);
    expect(new NotFoundError("x").status).toBe(404);
    expect(new ConflictError("x").status).toBe(409);
  });
  it("isAppError narrows", () => {
    expect(isAppError(new ForbiddenError("x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(new ForbiddenError("x")).toBeInstanceOf(AppError);
  });
});
