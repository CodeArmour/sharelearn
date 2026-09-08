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
  it("maps vocabulary → fields keyed like the Add form", () => {
    const out = toAiSuggestion({
      type: "vocabulary",
      term: "afspreken",
      meaning: "to arrange",
      partOfSpeech: "verb",
      noticeKey: "checkTypeAndLevel",
    });
    expect(out).toEqual({
      type: "vocabulary",
      fields: { term: "afspreken", meaning: "to arrange", partOfSpeech: "verb" },
      noticeKey: "checkTypeAndLevel",
    });
  });

  it("defaults an absent vocabulary partOfSpeech to an empty string", () => {
    const out = toAiSuggestion({ type: "vocabulary", term: "x", meaning: "y" });
    expect(out.fields.partOfSpeech).toBe("");
  });

  it("maps grammar and lifts worked examples", () => {
    const out = toAiSuggestion({
      type: "grammar",
      title: "Woordvolgorde",
      explanation: "In a main clause the finite verb is second.",
      examples: [{ nl: "Ik ga morgen naar huis.", en: "I go home tomorrow." }],
    });
    expect(out).toEqual({
      type: "grammar",
      fields: {
        title: "Woordvolgorde",
        summary: "",
        explanation: "In a main clause the finite verb is second.",
      },
      examples: [{ nl: "Ik ga morgen naar huis.", en: "I go home tomorrow." }],
    });
  });

  it("maps reading body → readingBody", () => {
    const out = toAiSuggestion({ type: "reading", title: "Op de markt", body: "Het is druk..." });
    expect(out.fields).toEqual({ title: "Op de markt", readingBody: "Het is druk...", summary: "" });
  });

  it("maps note body → noteBody and defaults the title", () => {
    const out = toAiSuggestion({ type: "note", body: "Remember to ask about de/het." });
    expect(out.fields).toEqual({ title: "", noteBody: "Remember to ask about de/het." });
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
