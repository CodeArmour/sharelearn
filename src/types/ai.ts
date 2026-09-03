import type { KnowledgeType } from "./knowledge";

/** How the AI capture step classifies a picked file — drives the suggestion. */
export type AiAttachmentKind = "image" | "pdf" | "document";

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
  /**
   * Key under `add.ai.notice.*` for a line the reviewer should see — e.g.
   * "couldn't determine the level". The real provider will return a key too.
   */
  noticeKey?: string;
}
