import { describe, expect, it } from "vitest";

import type { AiSuggestion } from "@/types";

import { buildCreateInput, missingRequired, suggestionToDraft } from "./suggestion-to-input";

describe("suggestionToDraft", () => {
  it("copies fields and assigns ids to grammar examples", () => {
    const s: AiSuggestion = {
      type: "grammar",
      fields: { title: "V2", summary: "", explanation: "verb second" },
      examples: [{ nl: "Nu ga ik.", en: "Now I go." }],
    };
    const draft = suggestionToDraft(s);
    expect(draft.type).toBe("grammar");
    expect(draft.values.title).toBe("V2");
    expect(draft.examples[0]).toMatchObject({ nl: "Nu ga ik.", en: "Now I go." });
    expect(typeof draft.examples[0].id).toBe("string");
  });
});

describe("missingRequired", () => {
  it("flags a vocabulary draft with no partOfSpeech", () => {
    expect(missingRequired("vocabulary", { term: "de fiets", meaning: "the bike", partOfSpeech: "" })).toEqual([
      "partOfSpeech",
    ]);
  });
  it("flags a grammar draft with no summary", () => {
    expect(missingRequired("grammar", { title: "V2", summary: "  ", explanation: "e" })).toEqual(["summary"]);
  });
  it("returns nothing when every required field is filled", () => {
    expect(missingRequired("note", { noteBody: "hello" })).toEqual([]);
  });
});

describe("buildCreateInput", () => {
  it("builds a valid vocabulary input", () => {
    const input = buildCreateInput(
      "vocabulary",
      { term: "de fiets", meaning: "the bike", partOfSpeech: "noun", article: "de", level: "A1", tags: "vervoer" },
      [],
      "ai-assisted",
    );
    expect(input).toMatchObject({ type: "vocabulary", term: "de fiets", article: "de", source: "ai-assisted" });
  });
  it("drops blank grammar examples", () => {
    const input = buildCreateInput(
      "grammar",
      { title: "V2", summary: "s", explanation: "e" },
      [
        { id: "1", nl: "Nu ga ik.", en: "Now I go." },
        { id: "2", nl: "   ", en: "" },
      ],
      "ai-assisted",
    );
    if (input.type !== "grammar") throw new Error("unreachable");
    expect(input.examples).toEqual([{ nl: "Nu ga ik.", en: "Now I go." }]);
  });
});
