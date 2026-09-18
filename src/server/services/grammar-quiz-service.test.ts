// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateGrammarQuiz, setGrammarQuiz } = vi.hoisted(() => ({
  generateGrammarQuiz: vi.fn(),
  setGrammarQuiz: vi.fn(),
}));
vi.mock("@/ai/services/grammar-quiz", () => ({ generateGrammarQuiz }));
vi.mock("@/server/repositories/knowledge", () => ({ setGrammarQuiz }));

import { grammarSourceHash } from "@/lib/grammar-quiz-hash";
import type { GrammarQuiz } from "@/types";

import { ensureGrammarQuiz } from "./grammar-quiz-service";

const CONTENT = {
  title: "Woordvolgorde",
  summary: "Werkwoord op de tweede plaats.",
  explanation: "In een hoofdzin staat het werkwoord op de tweede plaats.",
  examples: [{ nl: "Ik werk vandaag.", en: "I work today." }],
};
const quiz: GrammarQuiz = {
  promptVersion: "v1",
  generatedAt: "2026-09-18T00:00:00.000Z",
  sourceHash: grammarSourceHash(CONTENT),
  questions: [
    { id: "q1", kind: "fill-blank", prompt: "?", options: ["a", "b", "c", "d"], correctIndex: 0 },
  ],
};

const rule = (grammarQuiz: GrammarQuiz | null) => ({
  id: "g1",
  groupId: "grp1",
  ...CONTENT,
  level: "A2" as string | null,
  grammarQuiz,
});

beforeEach(() => {
  generateGrammarQuiz.mockReset();
  setGrammarQuiz.mockReset();
});

describe("ensureGrammarQuiz", () => {
  it("no-ops when the stored quiz was generated from the current content", async () => {
    const result = await ensureGrammarQuiz(rule(quiz));
    expect(result).toEqual({ generated: false });
    expect(generateGrammarQuiz).not.toHaveBeenCalled();
    expect(setGrammarQuiz).not.toHaveBeenCalled();
  });

  it("generates and persists when there is no stored quiz", async () => {
    generateGrammarQuiz.mockResolvedValue({ status: "ok", quiz });
    const result = await ensureGrammarQuiz(rule(null));
    expect(result).toEqual({ generated: true });
    expect(generateGrammarQuiz).toHaveBeenCalledWith({
      title: CONTENT.title,
      summary: CONTENT.summary,
      explanation: CONTENT.explanation,
      examples: CONTENT.examples,
      level: "A2",
      sourceHash: grammarSourceHash(CONTENT),
    });
    expect(setGrammarQuiz).toHaveBeenCalledWith("grp1", "g1", quiz);
  });

  it("regenerates when the stored quiz's sourceHash is stale", async () => {
    generateGrammarQuiz.mockResolvedValue({ status: "ok", quiz });
    const stale = { ...quiz, sourceHash: "stale" };
    const result = await ensureGrammarQuiz(rule(stale));
    expect(result).toEqual({ generated: true });
    expect(setGrammarQuiz).toHaveBeenCalledWith("grp1", "g1", quiz);
  });

  it("does not persist when generation is unavailable or errors", async () => {
    generateGrammarQuiz.mockResolvedValue({ status: "unavailable" });
    expect(await ensureGrammarQuiz(rule(null))).toEqual({ generated: false });
    generateGrammarQuiz.mockResolvedValue({ status: "error" });
    expect(await ensureGrammarQuiz(rule(null))).toEqual({ generated: false });
    expect(setGrammarQuiz).not.toHaveBeenCalled();
  });
});
