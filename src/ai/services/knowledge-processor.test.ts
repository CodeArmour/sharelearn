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

  it("does not make a follow-up call when a grammar result already has examples", async () => {
    generateStructured.mockResolvedValue({
      type: "grammar",
      title: "V2",
      explanation: "verb second",
      examples: [{ nl: "Morgen ga ik.", en: "Tomorrow I go." }],
    });
    const result = await structureKnowledge("v2 word order");
    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ok");
  });

  it("fetches examples in a follow-up call when a grammar result has none", async () => {
    generateStructured
      .mockResolvedValueOnce({
        type: "grammar",
        title: "Perfectum",
        explanation: "hebben/zijn + past participle",
      })
      .mockResolvedValueOnce({
        examples: [
          { nl: "Ik heb gewerkt.", en: "I have worked." },
          { nl: "Zij is gekomen.", en: "She has come." },
        ],
      });

    const result = await structureKnowledge("the perfect tense");

    expect(generateStructured).toHaveBeenCalledTimes(2);
    const followup = generateStructured.mock.calls[1][0];
    expect(followup.system).toContain("example sentences for a Dutch grammar rule");
    expect(followup.user).toContain("Perfectum");
    expect(result).toMatchObject({
      status: "ok",
      suggestion: {
        type: "grammar",
        examples: [
          { nl: "Ik heb gewerkt.", en: "I have worked." },
          { nl: "Zij is gekomen.", en: "She has come." },
        ],
      },
    });
  });

  it("accepts the follow-up examples under the `sentences` alias key", async () => {
    generateStructured
      .mockResolvedValueOnce({ type: "grammar", title: "V2", explanation: "verb second" })
      .mockResolvedValueOnce({
        sentences: [
          { nl: "Morgen ga ik.", en: "Tomorrow I go." },
          { nl: "Hier woon ik.", en: "I live here." },
        ],
      });

    const result = await structureKnowledge("v2");

    expect(result).toMatchObject({
      status: "ok",
      suggestion: {
        examples: [
          { nl: "Morgen ga ik.", en: "Tomorrow I go." },
          { nl: "Hier woon ik.", en: "I live here." },
        ],
      },
    });
  });

  it("keeps the grammar suggestion if the examples follow-up fails", async () => {
    generateStructured
      .mockResolvedValueOnce({ type: "grammar", title: "Perfectum", explanation: "..." })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await structureKnowledge("the perfect tense");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.suggestion.examples).toEqual([]);
    }
  });

  it("makes no follow-up call for a non-grammar result without examples", async () => {
    generateStructured.mockResolvedValue({ type: "note", body: "n" });
    await structureKnowledge("a note");
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });
});
