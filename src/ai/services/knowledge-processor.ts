import "server-only";

import { getAiProvider } from "@/ai/providers";
import type { AiProvider } from "@/ai/providers";
import {
  GRAMMAR_EXAMPLES_PROMPT,
  KNOWLEDGE_PROCESSOR_PROMPT_V2,
  PROMPT_VERSION,
} from "@/ai/prompts/knowledge-processor";
import {
  grammarExamplesResultSchema,
  knowledgeSuggestionSchema,
  toAiSuggestion,
} from "@/ai/schemas/knowledge-suggestion";
import type { AiSuggestion } from "@/types";

export type StructureResult =
  | { status: "ok"; suggestion: AiSuggestion }
  | { status: "unavailable" }
  | { status: "error" };

const MAX_CHARS = 10_000;

/**
 * Turn pasted study text into a reviewable `AiSuggestion`. Never throws:
 * `unavailable` means no API key is configured, `error` means the model call
 * failed or returned something unusable. The caller always drops the reviewer
 * into a form afterwards, so a soft failure is fine.
 */
export async function structureKnowledge(rawText: string): Promise<StructureResult> {
  try {
    const provider = getAiProvider();
    if (!provider) return { status: "unavailable" };

    const user = `<pasted_text>\n${rawText.trim().slice(0, MAX_CHARS)}\n</pasted_text>`;

    const raw = await provider.generateStructured({
      system: KNOWLEDGE_PROCESSOR_PROMPT_V2,
      user,
      schema: knowledgeSuggestionSchema,
    });

    const parsed = knowledgeSuggestionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ai:knowledge-processor:${PROMPT_VERSION}] schema validation failed`,
        parsed.error.issues,
      );
      return { status: "error" };
    }

    const suggestion = toAiSuggestion(parsed.data);
    await ensureGrammarExamples(provider, suggestion);
    return { status: "ok", suggestion };
  } catch (error) {
    console.error(`[ai:knowledge-processor:${PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}

/**
 * The model sometimes returns a grammar item with no `examples` (occasionally
 * putting the example sentences in `explanation` instead). Worked sentences are
 * the most useful part of a grammar card, so when they're missing we make one
 * focused follow-up call for them. Best-effort: a failure here leaves the
 * suggestion as-is — the reviewer can still add examples by hand.
 */
async function ensureGrammarExamples(provider: AiProvider, suggestion: AiSuggestion): Promise<void> {
  if (suggestion.type !== "grammar" || (suggestion.examples?.length ?? 0) > 0) return;

  const { title = "", explanation = "" } = suggestion.fields;
  if (!explanation && !title) return;

  try {
    const result = await provider.generateStructured({
      system: GRAMMAR_EXAMPLES_PROMPT,
      user: `Rule: ${title}\n\n${explanation}`,
      schema: grammarExamplesResultSchema,
    });
    const checked = grammarExamplesResultSchema.safeParse(result);
    const list = checked.success ? (checked.data.examples ?? checked.data.sentences ?? []) : [];
    if (list.length > 0) {
      suggestion.examples = list.map((e) => ({ nl: e.nl, en: e.en ?? "" }));
    }
  } catch (error) {
    console.error(`[ai:knowledge-processor:${PROMPT_VERSION}] grammar-examples follow-up failed`, error);
  }
}
