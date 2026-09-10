// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readingQuizGenerationSchema, toReadingQuiz } from "./reading-quiz";

const mcq = {
  kind: "mcq" as const,
  prompt: "Waarover gaat de tekst?",
  options: ["Een markt", "Een school", "Een station", "Een museum"],
  correctIndex: 0,
};
const tf = { kind: "true-false" as const, prompt: "De markt is op zaterdag.", correctIndex: 0 };

describe("readingQuizGenerationSchema", () => {
  it("accepts a mix of mcq and true-false", () => {
    const r = readingQuizGenerationSchema.safeParse({ questions: [mcq, tf, mcq] });
    expect(r.success).toBe(true);
  });

  it("rejects an mcq without exactly 4 options", () => {
    const r = readingQuizGenerationSchema.safeParse({
      questions: [{ ...mcq, options: ["a", "b", "c"] }, tf, mcq],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an mcq correctIndex out of range", () => {
    const r = readingQuizGenerationSchema.safeParse({
      questions: [{ ...mcq, correctIndex: 4 }, tf, mcq],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a true-false correctIndex of 2", () => {
    const r = readingQuizGenerationSchema.safeParse({ questions: [{ ...tf, correctIndex: 2 }, mcq, mcq] });
    expect(r.success).toBe(false);
  });

  it("rejects fewer than 3 questions", () => {
    const r = readingQuizGenerationSchema.safeParse({ questions: [mcq, tf] });
    expect(r.success).toBe(false);
  });
});

describe("toReadingQuiz", () => {
  it("assigns ids, injects Waar/Onwaar for true-false, and stamps metadata", () => {
    const quiz = toReadingQuiz(
      { questions: [mcq, tf] },
      { promptVersion: "v1", sourceHash: "abc123" },
    );
    expect(quiz.promptVersion).toBe("v1");
    expect(quiz.sourceHash).toBe("abc123");
    expect(quiz.generatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(quiz.questions[0]).toEqual({
      id: "q1",
      kind: "mcq",
      prompt: mcq.prompt,
      options: mcq.options,
      correctIndex: 0,
    });
    expect(quiz.questions[1]).toEqual({
      id: "q2",
      kind: "true-false",
      prompt: tf.prompt,
      options: ["Waar", "Onwaar"],
      correctIndex: 0,
    });
  });
});
