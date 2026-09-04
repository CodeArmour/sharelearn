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

import {
  createKnowledgeItemSchema,
  knowledgeIdsSchema,
  practiceSetupSchema,
} from "./schemas";

describe("createKnowledgeItemSchema", () => {
  it("accepts a minimal vocabulary item", () => {
    const parsed = createKnowledgeItemSchema.safeParse({
      type: "vocabulary",
      level: "B1",
      tags: ["uitdrukking"],
      source: "manual",
      term: "gezellig",
      meaning: "cozy",
      partOfSpeech: "Bijvoeglijk naamwoord",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects vocabulary missing meaning", () => {
    const parsed = createKnowledgeItemSchema.safeParse({
      type: "vocabulary",
      level: null,
      tags: [],
      source: "manual",
      term: "gezellig",
      partOfSpeech: "Bijvoeglijk naamwoord",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a note with no title", () => {
    const parsed = createKnowledgeItemSchema.safeParse({
      type: "note",
      level: null,
      tags: [],
      source: "manual",
      title: null,
      body: "Onthoud dit.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(
      createKnowledgeItemSchema.safeParse({ type: "file", level: null, tags: [], source: "manual" })
        .success,
    ).toBe(false);
  });
});

describe("practiceSetupSchema", () => {
  it("accepts a mixed/all setup", () => {
    expect(
      practiceSetupSchema.safeParse({ mode: "mixed", scope: "all", length: 10 }).success,
    ).toBe(true);
  });
  it("rejects a negative length", () => {
    expect(
      practiceSetupSchema.safeParse({ mode: "mixed", scope: "all", length: -1 }).success,
    ).toBe(false);
  });
});

describe("knowledgeIdsSchema", () => {
  it("requires every id to be a uuid", () => {
    expect(knowledgeIdsSchema.safeParse(["not-a-uuid"]).success).toBe(false);
  });
});
