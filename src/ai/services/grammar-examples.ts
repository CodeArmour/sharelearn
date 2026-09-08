import "server-only";

import type { AiProvider } from "@/ai/providers";
import { GRAMMAR_EXAMPLES_PROMPT } from "@/ai/prompts/knowledge-processor";
import { grammarExamplesResultSchema } from "@/ai/schemas/knowledge-suggestion";
import type { AiSuggestion } from "@/types";

/**
 * The model sometimes returns a grammar item with no `examples` (occasionally
 * putting the example sentences in `explanation` instead). Worked sentences are
 * the most useful part of a grammar card, so when they're missing we make one
 * focused follow-up call for them. Best-effort: a failure here leaves the
 * suggestion as-is — the reviewer can still add examples by hand.
 */
export async function ensureGrammarExamples(
  provider: AiProvider,
  suggestion: AiSuggestion,
): Promise<void> {
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
    console.error(`[ai:grammar-examples] follow-up failed`, error);
  }
}
