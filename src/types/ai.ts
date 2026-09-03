import type { KnowledgeType } from "./knowledge";

/**
 * Frontend contract for what the AI structuring step returns. A *proposal* only —
 * nothing is written to the shared library until a person confirms it. When the
 * real provider lands, `ai/services/KnowledgeProcessor` returns this shape and
 * the `data/mock` stand-in is dropped.
 */
export interface AiSuggestion {
  type: KnowledgeType;
  /** Pre-filled values keyed like the Add form fields (`term`, `title`, …). */
  fields: Record<string, string>;
  /** Worked examples, for a grammar suggestion. */
  examples?: { nl: string; en: string }[];
  /** A note the reviewer should see — e.g. "couldn't determine the level". */
  notice?: string;
}
