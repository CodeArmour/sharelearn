/**
 * Draft contracts for PERSONAL (per-user) state — kept separate from shared
 * knowledge on purpose. Nothing here is rendered in the foundation phase; the
 * shapes exist so feature work can build against a stable boundary.
 *
 * Shared vs personal:
 *   shared    -> knowledge, vocabulary, grammar, readings, files (group library)
 *   personal  -> review marks, practice sessions/results, exam attempts/results
 */

import type { CEFRLevel } from "./cefr";
import type { PracticeScope } from "./practice";

/** "I find this vocabulary hard — practise it later." (personal, per user) */
export interface ReviewMark {
  knowledgeId: string;
  /** ISO 8601 timestamp. */
  markedAt: string;
}

export type PracticeMode = "vocabulary" | "grammar" | "reading" | "mixed";

export type StudyRunKind = "practice" | "exam";

/** The client's finished-run payload → the server. */
export interface StudyRunInput {
  kind: StudyRunKind;
  /** null for exams (always mixed); the practice mode otherwise. */
  mode: PracticeMode | null;
  scope: PracticeScope;
  /** Set only when `scope === "level"`. */
  level: CEFRLevel | null;
  questionCount: number;
  correctCount: number;
  /** ISO 8601. */
  startedAt: string;
  /** ISO 8601. */
  completedAt: string;
}

/** One finished practice or exam run (personal history). */
export interface StudyRunSummary extends StudyRunInput {
  id: string;
  /** 0–100, derived from the counts. */
  scorePercent: number;
}

export interface StudyHistory {
  runs: StudyRunSummary[];
  totals: { runCount: number; avgScorePercent: number };
  markedCount: number;
}
