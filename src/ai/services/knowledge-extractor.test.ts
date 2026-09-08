// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateStructured, getAiProvider, ensureGrammarExamples } = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  getAiProvider: vi.fn(),
  ensureGrammarExamples: vi.fn(),
}));

vi.mock("@/ai/providers", () => ({
  getAiProvider,
  AiProviderError: class AiProviderError extends Error {},
}));
vi.mock("@/ai/services/grammar-examples", () => ({ ensureGrammarExamples }));

import { extractKnowledgeFromImages } from "./knowledge-extractor";

const IMAGES = [{ url: "https://signed/one" }];

beforeEach(() => {
  generateStructured.mockReset();
  getAiProvider.mockReset();
  ensureGrammarExamples.mockReset();
  getAiProvider.mockReturnValue({ name: "fake", generateStructured });
});

describe("extractKnowledgeFromImages", () => {
  it("returns unavailable when no provider is configured", async () => {
    getAiProvider.mockReturnValue(null);
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "unavailable" });
  });

  it("returns error when given no images", async () => {
    expect(await extractKnowledgeFromImages([])).toEqual({ status: "error" });
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("maps a mixed set through toAiSuggestion, preserving per-type fields", async () => {
    generateStructured.mockResolvedValue({
      items: [
        {
          type: "vocabulary",
          term: "werken",
          meaning: "to work",
          partOfSpeech: "verb",
          pastTense: "werkte",
          perfect: "heeft gewerkt",
        },
        { type: "note", body: "ask about er" },
      ],
    });

    const result = await extractKnowledgeFromImages(IMAGES);

    expect(result).toMatchObject({ status: "ok", truncated: false });
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.items[0]).toMatchObject({
      type: "vocabulary",
      fields: { term: "werken", meaning: "to work", pastTense: "werkte", perfect: "heeft gewerkt" },
    });
    expect(result.items[1]).toMatchObject({ type: "note" });
  });

  it("flags truncated when exactly 30 items come back", async () => {
    const items = Array.from({ length: 30 }, () => ({ type: "note", body: "n" }));
    generateStructured.mockResolvedValue({ items });
    const result = await extractKnowledgeFromImages(IMAGES);
    expect(result).toMatchObject({ status: "ok", truncated: true });
  });

  it("runs the grammar follow-up for at most 3 grammar items without examples", async () => {
    const grammar = (i: number) => ({ type: "grammar", title: `R${i}`, explanation: "e" });
    generateStructured.mockResolvedValue({
      items: [grammar(1), grammar(2), grammar(3), grammar(4), { type: "note", body: "n" }],
    });
    await extractKnowledgeFromImages(IMAGES);
    expect(ensureGrammarExamples).toHaveBeenCalledTimes(3);
  });

  it("does not run the follow-up for a grammar item that already has examples", async () => {
    generateStructured.mockResolvedValue({
      items: [
        { type: "grammar", title: "V2", explanation: "e", examples: [{ nl: "Nu ga ik.", en: "Now I go." }] },
      ],
    });
    await extractKnowledgeFromImages(IMAGES);
    expect(ensureGrammarExamples).not.toHaveBeenCalled();
  });

  it("returns error when the provider throws", async () => {
    generateStructured.mockRejectedValue(new Error("rate limited"));
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "error" });
  });

  it("returns error when the envelope is schema-invalid", async () => {
    generateStructured.mockResolvedValue({ items: [{ type: "vocabulary", term: "x" }] });
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "error" });
  });

  it("drops a malformed item and keeps the valid ones", async () => {
    generateStructured.mockResolvedValue({
      items: [
        { type: "vocabulary", term: "werken", meaning: "to work", partOfSpeech: "verb" },
        { type: "vocabulary", term: "x" },
      ],
    });
    const result = await extractKnowledgeFromImages(IMAGES);
    expect(result).toMatchObject({ status: "ok" });
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.items).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it("returns error only when every item is malformed", async () => {
    generateStructured.mockResolvedValue({
      items: [
        { type: "vocabulary", term: "x" },
        { type: "grammar", title: "T" },
      ],
    });
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "error" });
  });

  it("passes the extraction prompt and the images to the provider", async () => {
    generateStructured.mockResolvedValue({ items: [{ type: "note", body: "n" }] });
    await extractKnowledgeFromImages([{ url: "https://a" }, { url: "https://b" }]);
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.system).toContain("extract study material from photos");
    expect(arg.images).toEqual([{ url: "https://a" }, { url: "https://b" }]);
  });
});
