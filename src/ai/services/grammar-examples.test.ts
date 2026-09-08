// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiSuggestion } from "@/types";

import { ensureGrammarExamples } from "./grammar-examples";

const generateStructured = vi.fn();
const provider = { name: "fake", generateStructured } as never;

beforeEach(() => generateStructured.mockReset());

function grammar(examples: { nl: string; en: string }[] = []): AiSuggestion {
  return { type: "grammar", fields: { title: "Perfectum", explanation: "hebben/zijn + participle" }, examples };
}

describe("ensureGrammarExamples", () => {
  it("does nothing for a non-grammar suggestion", async () => {
    const s: AiSuggestion = { type: "note", fields: { noteBody: "n" } };
    await ensureGrammarExamples(provider, s);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("does nothing when the grammar item already has examples", async () => {
    await ensureGrammarExamples(provider, grammar([{ nl: "Ik heb gewerkt.", en: "I have worked." }]));
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("fills examples from a follow-up call when there are none", async () => {
    generateStructured.mockResolvedValue({
      examples: [{ nl: "Ik heb gewerkt.", en: "I have worked." }],
    });
    const s = grammar();
    await ensureGrammarExamples(provider, s);
    expect(s.examples).toEqual([{ nl: "Ik heb gewerkt.", en: "I have worked." }]);
  });

  it("accepts the `sentences` alias key", async () => {
    generateStructured.mockResolvedValue({ sentences: [{ nl: "Hier woon ik.", en: "I live here." }] });
    const s = grammar();
    await ensureGrammarExamples(provider, s);
    expect(s.examples).toEqual([{ nl: "Hier woon ik.", en: "I live here." }]);
  });

  it("leaves the suggestion untouched when the follow-up throws", async () => {
    generateStructured.mockRejectedValueOnce(new Error("boom"));
    const s = grammar();
    await ensureGrammarExamples(provider, s);
    expect(s.examples).toEqual([]);
  });
});
