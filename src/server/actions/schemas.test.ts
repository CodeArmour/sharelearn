// @vitest-environment node
import { describe, expect, it } from "vitest";

import { InviteError, ForbiddenError } from "@/server/errors";

import { emailSchema, groupIdSchema, toActionError } from "./schemas";

describe("action schemas", () => {
  it("accepts a valid email, trims + lowercases", () => {
    expect(emailSchema.parse("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it("rejects a bad email", () => {
    expect(emailSchema.safeParse("nope").success).toBe(false);
  });
  it("requires a uuid group id", () => {
    expect(groupIdSchema.safeParse("not-uuid").success).toBe(false);
  });
});

describe("toActionError", () => {
  it("maps an AppError to its code", () => {
    expect(toActionError(new ForbiddenError("x"))).toMatchObject({
      code: "forbidden",
    });
  });
  it("maps an InviteError to its invite code", () => {
    expect(toActionError(new InviteError("expired"))).toMatchObject({
      code: "invite:expired",
    });
  });
  it("falls back to unknown", () => {
    expect(toActionError(new Error("boom"))).toMatchObject({ code: "unknown" });
  });
});
