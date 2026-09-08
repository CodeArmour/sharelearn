// @vitest-environment node
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import nl from "@/messages/nl.json";

import { knowledgeSuggestionSchema, NOTICE_KEYS, toAiSuggestion } from "./knowledge-suggestion";

describe("knowledgeSuggestionSchema", () => {
  it("accepts a minimal vocabulary suggestion", () => {
    const parsed = knowledgeSuggestionSchema.parse({
      type: "vocabulary",
      term: "gezellig",
      meaning: "cozy, convivial",
    });
    expect(parsed).toMatchObject({ type: "vocabulary", term: "gezellig" });
  });

  it("rejects an out-of-set noticeKey", () => {
    const r = knowledgeSuggestionSchema.safeParse({
      type: "note",
      body: "some text",
      noticeKey: "notARealKey",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a vocabulary suggestion missing `meaning`", () => {
    const r = knowledgeSuggestionSchema.safeParse({ type: "vocabulary", term: "gezellig" });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const r = knowledgeSuggestionSchema.safeParse({ type: "flashcard", term: "x", meaning: "y" });
    expect(r.success).toBe(false);
  });

  it("accepts a fully-populated vocabulary suggestion with the grammatical extras", () => {
    const r = knowledgeSuggestionSchema.safeParse({
      type: "vocabulary",
      term: "afspreken",
      meaning: "to arrange",
      partOfSpeech: "verb",
      example: "Zullen we iets afspreken?",
      exampleTranslation: "Shall we make plans?",
      pastTense: "sprak af",
      perfect: "heeft afgesproken",
      usageNote: "separable verb",
      level: "A2",
      tags: ["werkwoord"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an out-of-set article", () => {
    const r = knowledgeSuggestionSchema.safeParse({
      type: "vocabulary",
      term: "huis",
      meaning: "house",
      article: "das",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an out-of-set CEFR level", () => {
    const r = knowledgeSuggestionSchema.safeParse({
      type: "note",
      body: "x",
      level: "A0",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a proposed level + tags on a non-vocabulary type", () => {
    const r = knowledgeSuggestionSchema.safeParse({
      type: "grammar",
      title: "V2",
      explanation: "verb second",
      level: "B1",
      tags: ["woordvolgorde"],
    });
    expect(r.success).toBe(true);
  });
});

describe("NOTICE_KEYS", () => {
  it("has a matching add.ai.notice.* string in both locales", () => {
    for (const key of NOTICE_KEYS) {
      expect(en.add.ai.notice, `en.json missing ${key}`).toHaveProperty(key);
      expect(nl.add.ai.notice, `nl.json missing ${key}`).toHaveProperty(key);
    }
  });
});

describe("toAiSuggestion", () => {
  it("maps a full vocabulary suggestion → every form field, extras included", () => {
    const out = toAiSuggestion({
      type: "vocabulary",
      term: "afspreken",
      meaning: "to arrange",
      partOfSpeech: "verb",
      example: "Zullen we iets afspreken?",
      exampleTranslation: "Shall we make plans?",
      pastTense: "sprak af",
      perfect: "heeft afgesproken",
      usageNote: "separable verb",
      level: "A2",
      tags: ["werkwoord", "dagelijks"],
      noticeKey: "checkTypeAndLevel",
    });
    expect(out).toEqual({
      type: "vocabulary",
      fields: {
        term: "afspreken",
        meaning: "to arrange",
        partOfSpeech: "verb",
        example: "Zullen we iets afspreken?",
        exampleTranslation: "Shall we make plans?",
        article: "",
        plural: "",
        pastTense: "sprak af",
        perfect: "heeft afgesproken",
        usageNote: "separable verb",
        level: "A2",
        tags: "werkwoord, dagelijks",
      },
      noticeKey: "checkTypeAndLevel",
    });
  });

  it("defaults every omitted vocabulary field to an empty string", () => {
    const out = toAiSuggestion({ type: "vocabulary", term: "x", meaning: "y" });
    expect(out.fields).toEqual({
      term: "x",
      meaning: "y",
      partOfSpeech: "",
      example: "",
      exampleTranslation: "",
      article: "",
      plural: "",
      pastTense: "",
      perfect: "",
      usageNote: "",
      level: "",
      tags: "",
    });
    expect(out.noticeKey).toBeUndefined();
  });

  it("passes a noun's article through", () => {
    const out = toAiSuggestion({
      type: "vocabulary",
      term: "huis",
      meaning: "house",
      article: "het",
      plural: "huizen",
    });
    expect(out.fields.article).toBe("het");
    expect(out.fields.plural).toBe("huizen");
  });

  it("maps grammar, lifts worked examples, and carries level + tags", () => {
    const out = toAiSuggestion({
      type: "grammar",
      title: "Woordvolgorde",
      explanation: "In a main clause the finite verb is second.",
      examples: [{ nl: "Ik ga morgen naar huis.", en: "I go home tomorrow." }],
      level: "A2",
      tags: ["woordvolgorde"],
    });
    expect(out).toEqual({
      type: "grammar",
      fields: {
        title: "Woordvolgorde",
        summary: "",
        explanation: "In a main clause the finite verb is second.",
        level: "A2",
        tags: "woordvolgorde",
      },
      examples: [{ nl: "Ik ga morgen naar huis.", en: "I go home tomorrow." }],
    });
  });

  it("maps reading body → readingBody with empty shared fields when omitted", () => {
    const out = toAiSuggestion({ type: "reading", title: "Op de markt", body: "Het is druk..." });
    expect(out.fields).toEqual({
      title: "Op de markt",
      readingBody: "Het is druk...",
      summary: "",
      level: "",
      tags: "",
    });
  });

  it("maps note body → noteBody and defaults the title", () => {
    const out = toAiSuggestion({ type: "note", body: "Remember to ask about de/het." });
    expect(out.fields).toEqual({
      title: "",
      noteBody: "Remember to ask about de/het.",
      level: "",
      tags: "",
    });
    expect(out.noticeKey).toBeUndefined();
  });

  it("normalises grammar example en to a string", () => {
    const out = toAiSuggestion({
      type: "grammar",
      title: "T",
      explanation: "E",
      examples: [{ nl: "Zin zonder vertaling." }],
    });
    expect(out.examples).toEqual([{ nl: "Zin zonder vertaling.", en: "" }]);
  });
});

import { knowledgeExtractionSchema } from "./knowledge-suggestion";

describe("knowledgeExtractionSchema", () => {
  const vocab = { type: "vocabulary", term: "de fiets", meaning: "the bicycle" };
  const grammar = {
    type: "grammar",
    title: "V2",
    explanation: "finite verb second",
    examples: [{ nl: "Morgen ga ik.", en: "Tomorrow I go." }],
  };

  it("accepts a mixed set", () => {
    const r = knowledgeExtractionSchema.safeParse({ items: [vocab, grammar, { type: "note", body: "n" }] });
    expect(r.success).toBe(true);
  });

  it("rejects an empty set", () => {
    expect(knowledgeExtractionSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects more than 30 items", () => {
    const items = Array.from({ length: 31 }, () => vocab);
    expect(knowledgeExtractionSchema.safeParse({ items }).success).toBe(false);
  });

  it("rejects a set with one malformed member", () => {
    expect(
      knowledgeExtractionSchema.safeParse({ items: [vocab, { type: "vocabulary", term: "x" }] }).success,
    ).toBe(false);
  });

  it("has no summary field (extra keys stripped, summary not required)", () => {
    const r = knowledgeExtractionSchema.safeParse({ items: [vocab] });
    expect(r.success).toBe(true);
    if (r.success) expect("summary" in r.data).toBe(false);
  });

  it("keeps a vocabulary item's full grammatical extras", () => {
    const full = {
      type: "vocabulary",
      term: "werken",
      meaning: "to work",
      partOfSpeech: "verb",
      pastTense: "werkte",
      perfect: "heeft gewerkt",
      example: "Ik werk hier.",
      exampleTranslation: "I work here.",
      level: "A2",
      tags: ["werkwoord"],
    };
    const r = knowledgeExtractionSchema.safeParse({ items: [full] });
    expect(r.success).toBe(true);
  });
});
