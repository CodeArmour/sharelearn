import { describe, expect, it } from "vitest";

import { grammarQuizGenerationSchema, toGrammarQuiz } from "./grammar-quiz";

const fillBlank = {
  kind: "fill-blank" as const,
  prompt: "Ik ___ elke dag naar school.",
  options: ["loop", "loopt", "lopen", "gelopen"],
  correctIndex: 0,
};
const trueFalse = { kind: "true-false" as const, prompt: "Hij hebben een hond.", correctIndex: 1 };

describe("grammarQuizGenerationSchema", () => {
  it("accepts a mix of fill-blank and true-false questions", () => {
    const result = grammarQuizGenerationSchema.safeParse({
      questions: [fillBlank, trueFalse],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fill-blank question with fewer than 4 options", () => {
    const result = grammarQuizGenerationSchema.safeParse({
      questions: [{ ...fillBlank, options: ["loop", "loopt"] }, trueFalse],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate fill-blank options", () => {
    const result = grammarQuizGenerationSchema.safeParse({
      questions: [{ ...fillBlank, options: ["loop", "loop", "lopen", "gelopen"] }, trueFalse],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fill-blank correctIndex out of range", () => {
    const result = grammarQuizGenerationSchema.safeParse({
      questions: [{ ...fillBlank, correctIndex: 4 }, trueFalse],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a true-false correctIndex out of range", () => {
    const result = grammarQuizGenerationSchema.safeParse({
      questions: [fillBlank, { ...trueFalse, correctIndex: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty prompt", () => {
    const result = grammarQuizGenerationSchema.safeParse({
      questions: [{ ...fillBlank, prompt: "" }, trueFalse],
    });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 2 questions", () => {
    const result = grammarQuizGenerationSchema.safeParse({ questions: [fillBlank] });
    expect(result.success).toBe(false);
  });
});

describe("toGrammarQuiz", () => {
  it("assigns sequential ids, injects Waar/Onwaar, stamps metadata", () => {
    const parsed = grammarQuizGenerationSchema.parse({ questions: [fillBlank, trueFalse] });
    const quiz = toGrammarQuiz(parsed, { promptVersion: "v1", sourceHash: "abc123" });

    expect(quiz.promptVersion).toBe("v1");
    expect(quiz.sourceHash).toBe("abc123");
    expect(typeof quiz.generatedAt).toBe("string");
    expect(quiz.questions).toEqual([
      { id: "q1", kind: "fill-blank", prompt: fillBlank.prompt, options: fillBlank.options, correctIndex: 0 },
      { id: "q2", kind: "true-false", prompt: trueFalse.prompt, options: ["Waar", "Onwaar"], correctIndex: 1 },
    ]);
  });
});
