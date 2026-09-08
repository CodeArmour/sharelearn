import "server-only";

import { z } from "zod";

import {
  EXTRACTION_PROMPT_VERSION,
  KNOWLEDGE_EXTRACTION_PROMPT,
} from "@/ai/prompts/knowledge-extractor";
import { getAiProvider } from "@/ai/providers";
import {
  type KnowledgeSuggestion,
  knowledgeExtractionSchema,
  knowledgeSuggestionSchema,
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

    const envelope = z.object({ items: z.array(z.unknown()) }).safeParse(raw);
    if (!envelope.success) {
      console.error(
        `[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] schema validation failed`,
        envelope.error.issues,
      );
      return { status: "error" };
    }

    let dropped = 0;
    const kept: KnowledgeSuggestion[] = [];
    for (const entry of envelope.data.items) {
      const one = knowledgeSuggestionSchema.safeParse(entry);
      if (one.success) kept.push(one.data);
      else dropped += 1;
    }

    if (dropped > 0) {
      console.warn(
        `[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] dropped ${dropped} malformed item(s)`,
      );
    }

    if (kept.length === 0) return { status: "error" };

    const capped = kept.slice(0, MAX_ITEMS);
    const items = capped.map(toAiSuggestion);

    let followups = 0;
    for (const item of items) {
      if (followups >= MAX_GRAMMAR_FOLLOWUPS) break;
      if (item.type === "grammar" && (item.examples?.length ?? 0) === 0) {
        followups += 1;
        await ensureGrammarExamples(provider, item);
      }
    }

    return {
      status: "ok",
      items,
      truncated: kept.length >= MAX_ITEMS || dropped > 0,
    };
  } catch (error) {
    console.error(`[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}
