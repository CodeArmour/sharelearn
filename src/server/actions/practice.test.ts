// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveActiveContext, getKnowledgeItemById, ensureReadingQuiz } = vi.hoisted(() => ({
  resolveActiveContext: vi.fn(),
  getKnowledgeItemById: vi.fn(),
  ensureReadingQuiz: vi.fn(),
}));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext }));
vi.mock("@/server/repositories/knowledge", () => ({ getKnowledgeItemById }));
vi.mock("@/server/services/reading-quiz-service", () => ({ ensureReadingQuiz }));
// practice.ts also imports the deterministic generators; stub them out.
vi.mock("@/server/services/practice-service", () => ({
  generatePracticeQuestions: vi.fn(),
  generateExamQuestions: vi.fn(),
}));

import { generateReadingQuizAction } from "./practice";

const UUID = "11111111-1111-4111-8111-111111111111";

const okCtx = {
  status: "ok",
  user: { id: "u1" },
  activeGroup: { id: "g1", name: "G", slug: "g" },
  membership: { groupId: "g1", userId: "u1", role: "member" },
};

const reading = {
  id: UUID,
  type: "reading",
  title: "Op de markt",
  body: "tekst",
  level: "B1",
  readingQuiz: null,
};

beforeEach(() => {
  resolveActiveContext.mockReset().mockResolvedValue(okCtx);
  getKnowledgeItemById.mockReset();
  ensureReadingQuiz.mockReset();
});

describe("generateReadingQuizAction", () => {
  it("rejects a non-uuid id", async () => {
    expect(await generateReadingQuizAction("nope")).toEqual({
      ok: false,
      code: "validation",
      message: "Invalid id",
    });
  });

  it("is unauthorized without an active group", async () => {
    resolveActiveContext.mockResolvedValue({ status: "no-group" });
    const r = await generateReadingQuizAction(UUID);
    expect(r).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("no-ops for a missing item", async () => {
    getKnowledgeItemById.mockResolvedValue(null);
    expect(await generateReadingQuizAction(UUID)).toEqual({ ok: true, data: { generated: false } });
    expect(ensureReadingQuiz).not.toHaveBeenCalled();
  });

  it("no-ops for a non-reading item", async () => {
    getKnowledgeItemById.mockResolvedValue({ ...reading, type: "vocabulary" });
    expect(await generateReadingQuizAction(UUID)).toEqual({ ok: true, data: { generated: false } });
    expect(ensureReadingQuiz).not.toHaveBeenCalled();
  });

  it("calls ensureReadingQuiz for a reading and returns its result", async () => {
    getKnowledgeItemById.mockResolvedValue(reading);
    ensureReadingQuiz.mockResolvedValue({ generated: true });
    const r = await generateReadingQuizAction(UUID);
    expect(r).toEqual({ ok: true, data: { generated: true } });
    expect(ensureReadingQuiz).toHaveBeenCalledWith({
      id: UUID,
      groupId: "g1",
      title: "Op de markt",
      body: "tekst",
      level: "B1",
      readingQuiz: null,
    });
  });
});
