import { describe, expect, it } from "vitest";

import type { PracticeQuestion } from "@/types";

import { buildStudyRunInput } from "./study-run";

const q = (id: string, correctIndex: number): PracticeQuestion => ({
  id,
  knowledgeId: id,
  knowledgeType: "vocabulary",
  instructionKey: "meaningOf",
  prompt: "p",
  options: ["a", "b", "c"],
  correctIndex,
});

describe("buildStudyRunInput", () => {
  const questions = [q("1", 0), q("2", 1), q("3", 2)];
  const startedAt = "2026-09-01T10:00:00.000Z";

  it("counts correct answers and carries the practice mode", () => {
    const input = buildStudyRunInput({
      kind: "practice",
      setup: { mode: "vocabulary", scope: "all", level: undefined },
      questions,
      answers: [0, 0, 2], // 1st + 3rd correct
      startedAt,
    });
    expect(input).toMatchObject({
      kind: "practice",
      mode: "vocabulary",
      scope: "all",
      level: null,
      questionCount: 3,
      correctCount: 2,
      startedAt,
    });
    expect(Date.parse(input.completedAt)).not.toBeNaN();
  });

  it("nulls the mode for an exam", () => {
    const input = buildStudyRunInput({
      kind: "exam",
      setup: { mode: "mixed", scope: "all", level: undefined },
      questions,
      answers: [null, null, null],
      startedAt,
    });
    expect(input.mode).toBeNull();
    expect(input.correctCount).toBe(0);
  });

  it("keeps level only when scope is 'level'", () => {
    expect(
      buildStudyRunInput({
        kind: "practice",
        setup: { mode: "mixed", scope: "level", level: "A2" },
        questions,
        answers: [0, 1, 2],
        startedAt,
      }).level,
    ).toBe("A2");
    expect(
      buildStudyRunInput({
        kind: "practice",
        setup: { mode: "mixed", scope: "custom", level: "A2" },
        questions,
        answers: [0, 1, 2],
        startedAt,
      }).level,
    ).toBeNull();
  });
});
