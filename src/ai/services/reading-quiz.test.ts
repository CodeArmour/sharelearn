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

import { generateReadingQuiz } from "./reading-quiz";

const mcq = (n: number) => ({
  kind: "mcq" as const,
  prompt: `Vraag ${n}?`,
  options: ["a", "b", "c", "d"],
  correctIndex: 0,
});
const tf = (n: number) => ({ kind: "true-false" as const, prompt: `Stelling ${n}.`, correctIndex: 1 });

const passage = { title: "Op de markt", body: "Een lange tekst over de markt.", level: "B1", sourceHash: "h1" };

beforeEach(() => {
  generateStructured.mockReset();
  getAiProvider.mockReset();
  getAiProvider.mockReturnValue({ name: "fake", generateStructured });
});

describe("generateReadingQuiz", () => {
  it("returns unavailable when no provider is configured", async () => {
    getAiProvider.mockReturnValue(null);
    expect(await generateReadingQuiz(passage)).toEqual({ status: "unavailable" });
  });

  it("returns ok with a mapped quiz for a valid 6-question response", async () => {
    generateStructured.mockResolvedValue({
      questions: [mcq(1), tf(2), mcq(3), tf(4), mcq(5), tf(6)],
    });
    const result = await generateReadingQuiz(passage);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.quiz.questions).toHaveLength(6);
    expect(result.quiz.promptVersion).toBe("v1");
    expect(result.quiz.sourceHash).toBe("h1");
    expect(result.quiz.questions[1]).toMatchObject({ kind: "true-false", options: ["Waar", "Onwaar"] });
  });

  it("returns error when the provider throws", async () => {
    generateStructured.mockRejectedValue(new Error("rate limited"));
    expect(await generateReadingQuiz(passage)).toEqual({ status: "error" });
  });

  it("returns error when the response has fewer than 3 questions", async () => {
    generateStructured.mockResolvedValue({ questions: [mcq(1), tf(2)] });
    expect(await generateReadingQuiz(passage)).toEqual({ status: "error" });
  });

  it("accepts 3–4 questions and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateStructured.mockResolvedValue({ questions: [mcq(1), tf(2), mcq(3), tf(4)] });
    const result = await generateReadingQuiz(passage);
    expect(result.status).toBe("ok");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sends the passage delimited and the prompt as system", async () => {
    generateStructured.mockResolvedValue({ questions: [mcq(1), tf(2), mcq(3), tf(4), mcq(5)] });
    await generateReadingQuiz(passage);
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.system).toContain("reading-comprehension");
    expect(arg.user).toContain("<passage>");
    expect(arg.user).toContain("Op de markt");
    expect(arg.user).toContain("B1");
  });
});
