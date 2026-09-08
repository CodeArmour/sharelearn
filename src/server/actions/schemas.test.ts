// @vitest-environment node
import { describe, expect, it } from "vitest";

import { InviteError, ForbiddenError } from "@/server/errors";

import {
  createKnowledgeItemSchema,
  emailSchema,
  groupIdSchema,
  knowledgeIdsSchema,
  knowledgeItemIdSchema,
  otpCodeSchema,
  practiceSetupSchema,
  rawKnowledgeTextSchema,
  studyRunInputSchema,
  toActionError,
} from "./schemas";

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
  it("accepts a 6-digit OTP code and trims it", () => {
    expect(otpCodeSchema.parse("  123456 ")).toBe("123456");
  });
  it("rejects OTP codes that are not exactly 6 digits", () => {
    for (const bad of ["12345", "1234567", "12a456", "abcdef", ""]) {
      expect(otpCodeSchema.safeParse(bad).success).toBe(false);
    }
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
  it("filters out non-uuid ids instead of rejecting the whole array", () => {
    const parsed = knowledgeIdsSchema.safeParse(["not-a-uuid", "kn_gezellig"]);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual([]);
  });

  it("keeps valid uuids and drops the rest", () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    const parsed = knowledgeIdsSchema.safeParse([uuid, "not-a-uuid"]);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual([uuid]);
  });
});

describe("knowledgeItemIdSchema", () => {
  it("requires a uuid", () => {
    expect(knowledgeItemIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(knowledgeItemIdSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(true);
  });
});

describe("studyRunInputSchema", () => {
  const base = {
    scope: "all",
    level: null,
    questionCount: 10,
    correctCount: 7,
    startedAt: "2026-09-01T10:00:00.000Z",
    completedAt: "2026-09-01T10:05:00.000Z",
  };

  it("accepts a practice run with a mode", () => {
    expect(
      studyRunInputSchema.safeParse({ ...base, kind: "practice", mode: "mixed" }).success,
    ).toBe(true);
  });

  it("accepts an exam run with no mode (defaults to null)", () => {
    const parsed = studyRunInputSchema.safeParse({ ...base, kind: "exam" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.mode).toBeNull();
  });

  it("rejects a practice run without a mode", () => {
    expect(studyRunInputSchema.safeParse({ ...base, kind: "practice" }).success).toBe(false);
  });

  it("rejects an exam run that carries a mode", () => {
    expect(
      studyRunInputSchema.safeParse({ ...base, kind: "exam", mode: "vocabulary" }).success,
    ).toBe(false);
  });

  it("rejects correctCount greater than questionCount", () => {
    expect(
      studyRunInputSchema.safeParse({
        ...base,
        kind: "practice",
        mode: "mixed",
        correctCount: 11,
      }).success,
    ).toBe(false);
  });

  it("rejects a zero questionCount", () => {
    expect(
      studyRunInputSchema.safeParse({ ...base, kind: "exam", questionCount: 0, correctCount: 0 })
        .success,
    ).toBe(false);
  });
});

describe("rawKnowledgeTextSchema", () => {
  it("rejects empty / whitespace / 1-char input", () => {
    for (const bad of ["", "   ", "a"]) {
      expect(rawKnowledgeTextSchema.safeParse(bad).success).toBe(false);
    }
  });
  it("rejects input longer than 10k chars", () => {
    expect(rawKnowledgeTextSchema.safeParse("x".repeat(10_001)).success).toBe(false);
  });
  it("accepts and trims a normal paste", () => {
    expect(rawKnowledgeTextSchema.parse("  de hond — the dog  ")).toBe("de hond — the dog");
  });
});
