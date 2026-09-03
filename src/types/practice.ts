import type { KnowledgeType } from "./knowledge";
import type { PracticeMode } from "./personal";

/**
 * Frontend contracts for a practice run. Questions are generated from the
 * shared library (mock: `data/mock`; later: `ai/services/PracticeGenerator`).
 * A run is entirely client-side state — nothing is persisted yet.
 */

/** Which slice of the library to draw questions from. */
export type PracticeScope = "all" | "today" | "level";

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
  /** Max questions; `0` means "all available". */
  length: number;
}
