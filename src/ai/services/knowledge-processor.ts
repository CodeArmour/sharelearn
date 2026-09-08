import "server-only";

import { getAiProvider } from "@/ai/providers";
import { KNOWLEDGE_PROCESSOR_PROMPT_V2, PROMPT_VERSION } from "@/ai/prompts/knowledge-processor";
import { knowledgeSuggestionSchema, toAiSuggestion } from "@/ai/schemas/knowledge-suggestion";
import type { AiSuggestion } from "@/types";

import { ensureGrammarExamples } from "./grammar-examples";

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
