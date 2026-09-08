// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateStructured, getAiProvider } = vi.hoisted(() => {
  return {
    generateStructured: vi.fn(),
    getAiProvider: vi.fn(),
  };
});

vi.mock("@/ai/providers", () => ({
  getAiProvider,
  AiProviderError: class AiProviderError extends Error {},
}));

import { structureKnowledge } from "./knowledge-processor";

beforeEach(() => {
  generateStructured.mockReset();
  getAiProvider.mockReset();
  getAiProvider.mockReturnValue({ name: "fake", generateStructured });
});

describe("structureKnowledge", () => {
  it("returns unavailable when no provider is configured", async () => {
    getAiProvider.mockReturnValue(null);
    expect(await structureKnowledge("de hond — the dog")).toEqual({ status: "unavailable" });
  });

  it("returns ok + a mapped AiSuggestion for a vocabulary result", async () => {
    generateStructured.mockResolvedValue({
      type: "vocabulary",
      term: "de hond",
      meaning: "the dog",
      partOfSpeech: "noun",
      article: "de",
      plural: "de honden",
      level: "A1",
      tags: ["dieren", "zelfstandig naamwoord"],
      noticeKey: "checkTypeAndLevel",
    });

    const result = await structureKnowledge("de hond — the dog");

    expect(result).toEqual({
      status: "ok",
      suggestion: {
        type: "vocabulary",
        fields: {
          term: "de hond",
          meaning: "the dog",
          partOfSpeech: "noun",
          example: "",
          exampleTranslation: "",
          article: "de",
          plural: "de honden",
          pastTense: "",
          perfect: "",
          usageNote: "",
          level: "A1",
          tags: "dieren, zelfstandig naamwoord",
        },
        noticeKey: "checkTypeAndLevel",
      },
    });
  });

  it("returns error when the provider throws", async () => {
    generateStructured.mockRejectedValue(new Error("rate limited"));
    expect(await structureKnowledge("x y")).toEqual({ status: "error" });
  });

  it("returns error when the provider yields a schema-invalid object", async () => {
    generateStructured.mockResolvedValue({ type: "vocabulary", term: "only a term" });
    expect(await structureKnowledge("x y")).toEqual({ status: "error" });
  });

  it("passes the system prompt and the delimited raw text to the provider", async () => {
    generateStructured.mockResolvedValue({ type: "note", body: "n" });
    await structureKnowledge("  some pasted text  ");
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.system).toContain("Dutch-language learning");
    expect(arg.user).toBe("<pasted_text>\nsome pasted text\n</pasted_text>");
  });
});
