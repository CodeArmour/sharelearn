import "server-only";

import {
  EXTRACTION_PROMPT_VERSION,
  KNOWLEDGE_EXTRACTION_PROMPT,
} from "@/ai/prompts/knowledge-extractor";
import { getAiProvider } from "@/ai/providers";
import {
  knowledgeExtractionSchema,
  toAiSuggestion,
} from "@/ai/schemas/knowledge-suggestion";
import { ensureGrammarExamples } from "@/ai/services/grammar-examples";
import type { AiSuggestion } from "@/types";

export type ExtractResult =
  | { status: "ok"; items: AiSuggestion[]; truncated: boolean }
  | { status: "unavailable" }
  | { status: "error" };

const MAX_IMAGES = 3;
const MAX_ITEMS = 30;
const MAX_GRAMMAR_FOLLOWUPS = 3;

/**
 * Read 1–3 photos and return a reviewable set of `AiSuggestion`s. Never throws:
 * `unavailable` means no API key, `error` means the model call failed or
 * returned something unusable. The caller always drops the reviewer into the
 * checklist (or, on `error`/empty, the manual form), so a soft failure is fine.
 */
export async function extractKnowledgeFromImages(
  images: { url: string }[],
): Promise<ExtractResult> {
  try {
    const provider = getAiProvider();
    if (!provider) return { status: "unavailable" };

    const imgs = images.slice(0, MAX_IMAGES);
    if (imgs.length === 0) return { status: "error" };

    const user = `Extract every distinct study item from the ${imgs.length} attached image(s), with all per-type fields.`;

    const raw = await provider.generateStructured({
      system: KNOWLEDGE_EXTRACTION_PROMPT,
      user,
      schema: knowledgeExtractionSchema,
      images: imgs,
    });

    const parsed = knowledgeExtractionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] schema validation failed`,
        parsed.error.issues,
      );
      return { status: "error" };
    }

    const items = parsed.data.items.map(toAiSuggestion);

    let followups = 0;
    for (const item of items) {
      if (followups >= MAX_GRAMMAR_FOLLOWUPS) break;
      if (item.type === "grammar" && (item.examples?.length ?? 0) === 0) {
        followups += 1;
        await ensureGrammarExamples(provider, item);
      }
    }

    return { status: "ok", items, truncated: parsed.data.items.length >= MAX_ITEMS };
  } catch (error) {
    console.error(`[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}
