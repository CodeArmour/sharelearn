// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateStructured, getAiProvider } = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  getAiProvider: vi.fn(),
}));

vi.mock("@/ai/providers", () => ({
  getAiProvider,
  AiProviderError: class AiProviderError extends Error {},
}));

import { generateGrammarQuiz } from "./grammar-quiz";

const fillBlank = (n: number) => ({
  kind: "fill-blank" as const,
  prompt: `Zin ${n} ___.`,
  options: ["a", "b", "c", "d"],
  correctIndex: 0,
});
const tf = (n: number) => ({ kind: "true-false" as const, prompt: `Stelling ${n}.`, correctIndex: 1 });

const rule = {
  title: "Woordvolgorde",
  summary: "Werkwoord op de tweede plaats.",
  explanation: "In een hoofdzin staat het werkwoord altijd op de tweede plaats.",
  examples: [{ nl: "Ik werk vandaag.", en: "I work today." }],
  level: "A2",
  sourceHash: "h1",
};

beforeEach(() => {
  generateStructured.mockReset();
  getAiProvider.mockReset();
  getAiProvider.mockReturnValue({ name: "fake", generateStructured });
});

describe("generateGrammarQuiz", () => {
  it("returns unavailable when no provider is configured", async () => {
    getAiProvider.mockReturnValue(null);
    expect(await generateGrammarQuiz(rule)).toEqual({ status: "unavailable" });
  });

  it("returns ok with a mapped quiz for a valid 4-question response", async () => {
    generateStructured.mockResolvedValue({
      questions: [fillBlank(1), tf(2), fillBlank(3), tf(4)],
    });
    const result = await generateGrammarQuiz(rule);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.quiz.questions).toHaveLength(4);
    expect(result.quiz.promptVersion).toBe("v1");
    expect(result.quiz.sourceHash).toBe("h1");
    expect(result.quiz.questions[1]).toMatchObject({ kind: "true-false", options: ["Waar", "Onwaar"] });
  });

  it("returns error when the provider throws", async () => {
    generateStructured.mockRejectedValue(new Error("rate limited"));
    expect(await generateGrammarQuiz(rule)).toEqual({ status: "error" });
  });

  it("returns error when the response has fewer than 2 questions", async () => {
    generateStructured.mockResolvedValue({ questions: [fillBlank(1)] });
    expect(await generateGrammarQuiz(rule)).toEqual({ status: "error" });
  });

  it("accepts 2-3 questions and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateStructured.mockResolvedValue({ questions: [fillBlank(1), tf(2)] });
    const result = await generateGrammarQuiz(rule);
    expect(result.status).toBe("ok");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sends the rule delimited and the prompt as system", async () => {
    generateStructured.mockResolvedValue({ questions: [fillBlank(1), tf(2), fillBlank(3), tf(4)] });
    await generateGrammarQuiz(rule);
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.system).toContain("grammar practice questions");
    expect(arg.user).toContain("<rule>");
    expect(arg.user).toContain("Woordvolgorde");
    expect(arg.user).toContain("A2");
    expect(arg.user).toContain("Ik werk vandaag.");
  });

  it("truncates oversized fields before interpolating them into the prompt", async () => {
    generateStructured.mockResolvedValue({ questions: [fillBlank(1), tf(2), fillBlank(3), tf(4)] });
    const oversized = {
      ...rule,
      summary: "s".repeat(5_000),
      explanation: "e".repeat(5_000),
      examples: [{ nl: "n".repeat(5_000), en: "n".repeat(5_000) }],
    };
    await generateGrammarQuiz(oversized);
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.user).not.toContain("s".repeat(5_000));
    expect(arg.user).not.toContain("e".repeat(5_000));
    expect(arg.user).not.toContain("n".repeat(5_000));
    expect(arg.user).toContain("s".repeat(4_000));
    expect(arg.user).toContain("e".repeat(4_000));
    expect(arg.user).toContain("n".repeat(4_000));
  });
});
