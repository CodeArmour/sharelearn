import type { KnowledgeType } from "./knowledge";
import type { PracticeMode } from "./personal";

/**
 * Frontend contracts for a practice run. Questions are generated from the
 * shared library (mock: `data/mock`; later: `ai/services/PracticeGenerator`).
 * A run is entirely client-side state — nothing is persisted yet.
 */

/** Which slice of the library to draw questions from. */
export type PracticeScope = "all" | "today" | "level" | "custom" | "review";

/** A saved Library filter carried into a practice/exam run (`scope: "custom"`). */
export interface PracticeFilter {
  /** Free-text search, matched the same way the Library matches it. */
  q?: string;
  type?: KnowledgeType;
  level?: string;
  /** Group member id. */
  by?: string;
}

/** Message key under `practice.instruction.*` for a question's one-line prompt. */
export type PracticeInstructionKey = "meaningOf" | "sayInDutch" | "whichRule";

/** One generated multiple-choice question. */
export interface PracticeQuestion {
  id: string;
  /** Knowledge item this tests — drives the "view the knowledge" link. */
  knowledgeId: string;
  knowledgeType: KnowledgeType;
  instructionKey: PracticeInstructionKey;
  /** The thing to react to (a Dutch term, an English gloss, an example sentence). */
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface PracticeSetup {
  /** "vocabulary" | "grammar" | "mixed" — Setup does not surface "reading". */
  mode: PracticeMode;
  scope: PracticeScope;
  /** Required when `scope === "level"`. */
  level?: string;
  /** Present when `scope === "custom"` (from a Library filter). */
  filter?: PracticeFilter;
  /** Knowledge ids marked for review; used when `scope === "review"`. */
  reviewIds?: string[];
  /** Max questions; `0` means "all available". */
  length: number;
}
