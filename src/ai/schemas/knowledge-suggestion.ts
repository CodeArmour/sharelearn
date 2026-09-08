import { z } from "zod";

import type { AiSuggestion } from "@/types";

/**
 * The closed set of reviewer-hint keys the model may return. Each maps to an
 * existing `add.ai.notice.*` i18n string. Keep in sync with the schema below
 * and with `src/messages/*.json`.
 */
export const NOTICE_KEYS = [
  "checkTypeAndLevel",
  "titleAndSummary",
  "summaryAndExamples",
  "meaningAndType",
] as const;

const noticeKey = z.enum(NOTICE_KEYS).optional();

const grammarExample = z.object({
  nl: z.string().min(1),
  en: z.string().optional(),
});

/**
 * What the model must return — a discriminated union on `type`, one member per
 * authorable knowledge type. Field names match the Add form. `level` is
 * intentionally absent: the reviewer sets CEFR level, the model must not guess.
 */
export const knowledgeSuggestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vocabulary"),
    term: z.string().min(1),
    meaning: z.string().min(1),
    partOfSpeech: z.string().optional(),
    noticeKey,
  }),
  z.object({
    type: z.literal("grammar"),
    title: z.string().min(1),
    explanation: z.string().min(1),
    summary: z.string().optional(),
    examples: z.array(grammarExample).optional(),
    noticeKey,
  }),
  z.object({
    type: z.literal("reading"),
    title: z.string().min(1),
    body: z.string().min(1),
    summary: z.string().optional(),
    noticeKey,
  }),
  z.object({
    type: z.literal("note"),
    body: z.string().min(1),
    title: z.string().optional(),
    noticeKey,
  }),
]);

export type KnowledgeSuggestion = z.infer<typeof knowledgeSuggestionSchema>;

/**
 * Flatten a validated suggestion into the `AiSuggestion` shape the Add screen
 * already consumes: `fields` keyed exactly like the form inputs, grammar
 * worked examples lifted to `examples`, `noticeKey` passed through untouched.
 */
export function toAiSuggestion(parsed: KnowledgeSuggestion): AiSuggestion {
  switch (parsed.type) {
    case "vocabulary":
      return {
        type: "vocabulary",
        fields: {
          term: parsed.term,
          meaning: parsed.meaning,
          partOfSpeech: parsed.partOfSpeech ?? "",
        },
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
    case "grammar":
      return {
        type: "grammar",
        fields: {
          title: parsed.title,
          summary: parsed.summary ?? "",
          explanation: parsed.explanation,
        },
        examples: (parsed.examples ?? []).map((e) => ({ nl: e.nl, en: e.en ?? "" })),
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
    case "reading":
      return {
        type: "reading",
        fields: {
          title: parsed.title,
          readingBody: parsed.body,
          summary: parsed.summary ?? "",
        },
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
    case "note":
      return {
        type: "note",
        fields: { title: parsed.title ?? "", noteBody: parsed.body },
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
  }
}
