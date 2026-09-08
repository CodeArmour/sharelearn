import { z } from "zod";

import { CEFR_LEVELS } from "@/types";
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

/**
 * Fields every type carries. All optional and all reviewer-confirmed — the
 * model proposes them, the person editing the Add form sees and can change
 * them before anything is saved.
 */
const shared = {
  /** Proposed CEFR level (A1–C2). */
  level: z.enum(CEFR_LEVELS).optional(),
  /** 0–6 short lowercase tags. */
  tags: z.array(z.string().min(1)).max(6).optional(),
  /** One reviewer hint from the closed set above, or omitted. */
  noticeKey: z.enum(NOTICE_KEYS).optional(),
};

const grammarExample = z.object({
  nl: z.string().min(1),
  en: z.string().optional(),
});

/**
 * What the model must return — a discriminated union on `type`, one member per
 * authorable knowledge type. Field names match the Add form. Every member also
 * spreads `shared` (level / tags / noticeKey). Vocabulary carries the full set
 * of grammatical extras the form supports; the model fills only the ones that
 * genuinely apply to the word.
 */
export const knowledgeSuggestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vocabulary"),
    term: z.string().min(1),
    meaning: z.string().min(1),
    partOfSpeech: z.string().min(1).optional(),
    /** A short natural Dutch sentence using the term, and its English. */
    example: z.string().min(1).optional(),
    exampleTranslation: z.string().min(1).optional(),
    /** Nouns only. */
    article: z.enum(["de", "het"]).optional(),
    /** The Dutch plural — nouns. */
    plural: z.string().min(1).optional(),
    /** Verbs, e.g. "werkte" / "heeft gewerkt". */
    pastTense: z.string().min(1).optional(),
    perfect: z.string().min(1).optional(),
    /** Register, a common mistake, or a useful collocation. */
    usageNote: z.string().min(1).optional(),
    ...shared,
  }),
  z.object({
    type: z.literal("grammar"),
    title: z.string().min(1),
    explanation: z.string().min(1),
    summary: z.string().min(1).optional(),
    examples: z.array(grammarExample).max(4).optional(),
    ...shared,
  }),
  z.object({
    type: z.literal("reading"),
    title: z.string().min(1),
    body: z.string().min(1),
    summary: z.string().min(1).optional(),
    ...shared,
  }),
  z.object({
    type: z.literal("note"),
    body: z.string().min(1),
    title: z.string().min(1).optional(),
    ...shared,
  }),
]);

export type KnowledgeSuggestion = z.infer<typeof knowledgeSuggestionSchema>;

/** The shared `level` / `tags` form values, as the Add form expects them
 *  (`level` a bare string, `tags` a comma-joined string). */
function sharedFields(p: { level?: string; tags?: readonly string[] }): {
  level: string;
  tags: string;
} {
  return { level: p.level ?? "", tags: (p.tags ?? []).join(", ") };
}

/**
 * Flatten a validated suggestion into the `AiSuggestion` shape the Add screen
 * consumes: `fields` keyed exactly like the form inputs (every type-appropriate
 * key present, "" when the model omitted it), grammar worked examples lifted to
 * `examples`, `noticeKey` passed through only when set.
 */
export function toAiSuggestion(parsed: KnowledgeSuggestion): AiSuggestion {
  const notice = parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {};

  switch (parsed.type) {
    case "vocabulary":
      return {
        type: "vocabulary",
        fields: {
          term: parsed.term,
          meaning: parsed.meaning,
          partOfSpeech: parsed.partOfSpeech ?? "",
          example: parsed.example ?? "",
          exampleTranslation: parsed.exampleTranslation ?? "",
          article: parsed.article ?? "",
          plural: parsed.plural ?? "",
          pastTense: parsed.pastTense ?? "",
          perfect: parsed.perfect ?? "",
          usageNote: parsed.usageNote ?? "",
          ...sharedFields(parsed),
        },
        ...notice,
      };
    case "grammar":
      return {
        type: "grammar",
        fields: {
          title: parsed.title,
          summary: parsed.summary ?? "",
          explanation: parsed.explanation,
          ...sharedFields(parsed),
        },
        examples: (parsed.examples ?? []).map((e) => ({ nl: e.nl, en: e.en ?? "" })),
        ...notice,
      };
    case "reading":
      return {
        type: "reading",
        fields: {
          title: parsed.title,
          readingBody: parsed.body,
          summary: parsed.summary ?? "",
          ...sharedFields(parsed),
        },
        ...notice,
      };
    case "note":
      return {
        type: "note",
        fields: {
          title: parsed.title ?? "",
          noteBody: parsed.body,
          ...sharedFields(parsed),
        },
        ...notice,
      };
  }
}
