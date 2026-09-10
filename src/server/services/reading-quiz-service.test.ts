// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateReadingQuiz, setReadingQuiz } = vi.hoisted(() => ({
  generateReadingQuiz: vi.fn(),
  setReadingQuiz: vi.fn(),
}));
vi.mock("@/ai/services/reading-quiz", () => ({ generateReadingQuiz }));
vi.mock("@/server/repositories/knowledge", () => ({ setReadingQuiz }));

import { readingBodyHash } from "@/lib/reading-quiz-hash";
import type { ReadingQuiz } from "@/types";

import { ensureReadingQuiz } from "./reading-quiz-service";

const BODY = "Een tekst over de markt op zaterdag.";
const quiz: ReadingQuiz = {
  promptVersion: "v1",
  generatedAt: "2026-09-09T00:00:00.000Z",
  sourceHash: readingBodyHash(BODY),
  questions: [{ id: "q1", kind: "mcq", prompt: "?", options: ["a", "b", "c", "d"], correctIndex: 0 }],
};

const reading = (readingQuiz: ReadingQuiz | null) => ({
  id: "r1",
  groupId: "g1",
  title: "Op de markt",
  body: BODY,
  level: "B1" as string | null,
  readingQuiz,
});

beforeEach(() => {
  generateReadingQuiz.mockReset();
  setReadingQuiz.mockReset();
});

describe("ensureReadingQuiz", () => {
  it("no-ops when the stored quiz was generated from the current body", async () => {
    const result = await ensureReadingQuiz(reading(quiz));
    expect(result).toEqual({ generated: false });
    expect(generateReadingQuiz).not.toHaveBeenCalled();
    expect(setReadingQuiz).not.toHaveBeenCalled();
  });

  it("generates and persists when there is no stored quiz", async () => {
    generateReadingQuiz.mockResolvedValue({ status: "ok", quiz });
    const result = await ensureReadingQuiz(reading(null));
    expect(result).toEqual({ generated: true });
    expect(generateReadingQuiz).toHaveBeenCalledWith({
      title: "Op de markt",
      body: BODY,
      level: "B1",
      sourceHash: readingBodyHash(BODY),
    });
    expect(setReadingQuiz).toHaveBeenCalledWith("g1", "r1", quiz);
  });

  it("regenerates when the stored quiz's sourceHash is stale", async () => {
    generateReadingQuiz.mockResolvedValue({ status: "ok", quiz });
    const stale = { ...quiz, sourceHash: "stale" };
    const result = await ensureReadingQuiz(reading(stale));
    expect(result).toEqual({ generated: true });
    expect(setReadingQuiz).toHaveBeenCalledWith("g1", "r1", quiz);
  });

  it("does not persist when generation is unavailable or errors", async () => {
    generateReadingQuiz.mockResolvedValue({ status: "unavailable" });
    expect(await ensureReadingQuiz(reading(null))).toEqual({ generated: false });
    generateReadingQuiz.mockResolvedValue({ status: "error" });
    expect(await ensureReadingQuiz(reading(null))).toEqual({ generated: false });
    expect(setReadingQuiz).not.toHaveBeenCalled();
  });
});
