/**
 * Draft contracts for PERSONAL (per-user) state — kept separate from shared
 * knowledge on purpose. Nothing here is rendered in the foundation phase; the
 * shapes exist so feature work can build against a stable boundary.
 *
 * Shared vs personal:
 *   shared    -> knowledge, vocabulary, grammar, readings, files (group library)
 *   personal  -> review marks, practice sessions/results, exam attempts/results
 */

/** "I find this vocabulary hard — practise it later." (personal, per user) */
export interface ReviewMark {
  knowledgeId: string;
  /** ISO 8601 timestamp. */
  markedAt: string;
}

export type PracticeMode = "vocabulary" | "grammar" | "reading" | "mixed";

/** Summary of one finished practice session (personal history). */
export interface PracticeResultSummary {
  id: string;
  mode: PracticeMode;
  startedAt: string;
  completedAt: string;
  questionCount: number;
  correctCount: number;
}

/** Summary of one finished exam attempt (personal history). */
export interface ExamResultSummary {
  id: string;
  startedAt: string;
  completedAt: string;
  questionCount: number;
  correctCount: number;
  /** 0–100. */
  scorePercent: number;
}
