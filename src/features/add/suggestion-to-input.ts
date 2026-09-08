import type { CreateKnowledgeItemInput } from "@/server/actions/schemas";
import type { AiSuggestion, KnowledgeSource } from "@/types";

import { type AuthableType, type Example, REQUIRED, type Values } from "./types";

function parseTags(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toNullable(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Reverse of the Add form's payload-builder — shapes the current form values
 *  into the Server Action's create input. Moved here from the view so the
 *  review checklist can reuse it for each selected row. */
export function buildCreateInput(
  type: AuthableType,
  values: Values,
  examples: Example[],
  source: KnowledgeSource,
): CreateKnowledgeItemInput {
  const shared = {
    level: (values.level || null) as CreateKnowledgeItemInput["level"],
    tags: parseTags(values.tags),
    source,
  };

  switch (type) {
    case "vocabulary":
      return {
        ...shared,
        type: "vocabulary",
        term: values.term!.trim(),
        meaning: values.meaning!.trim(),
        partOfSpeech: values.partOfSpeech!.trim(),
        example: toNullable(values.example),
        exampleTranslation: toNullable(values.exampleTranslation),
        article: values.article === "de" || values.article === "het" ? values.article : null,
        plural: toNullable(values.plural),
        pastTense: toNullable(values.pastTense),
        perfect: toNullable(values.perfect),
        usageNote: toNullable(values.usageNote),
      };
    case "grammar":
      return {
        ...shared,
        type: "grammar",
        title: values.title!.trim(),
        summary: values.summary!.trim(),
        explanation: values.explanation!.trim(),
        examples: examples
          .filter((e) => e.nl.trim().length > 0)
          .map((e) => ({ nl: e.nl.trim(), en: toNullable(e.en) })),
      };
    case "reading":
      return {
        ...shared,
        type: "reading",
        title: values.title!.trim(),
        body: values.readingBody!.trim(),
        summary: toNullable(values.summary),
      };
    case "note":
      return {
        ...shared,
        type: "note",
        title: toNullable(values.title),
        body: values.noteBody!.trim(),
      };
  }
}

/** Turn one AI suggestion into an editable review-row draft. `fields` are
 *  already keyed like the form; grammar examples get local ids. */
export function suggestionToDraft(s: AiSuggestion): {
  type: AuthableType;
  values: Values;
  examples: Example[];
} {
  return {
    type: s.type as AuthableType,
    values: { ...s.fields },
    examples: (s.examples ?? []).map((ex) => ({ id: crypto.randomUUID(), nl: ex.nl, en: ex.en })),
  };
}

/** Required field names for `type` that the draft has not filled — a non-empty
 *  result means the row must be opened in the full form before it can be saved. */
export function missingRequired(type: AuthableType, values: Values): string[] {
  return REQUIRED[type].filter((name) => !(values[name] ?? "").trim());
}
