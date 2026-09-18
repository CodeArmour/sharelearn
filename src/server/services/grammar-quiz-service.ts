import "server-only";

import { generateGrammarQuiz } from "@/ai/services/grammar-quiz";
import { grammarSourceHash } from "@/lib/grammar-quiz-hash";
import { setGrammarQuiz } from "@/server/repositories/knowledge";
import type { GrammarExample, GrammarQuiz } from "@/types";

/**
 * Make sure a grammar item has an up-to-date quiz. Fast-paths when the
 * stored quiz's `sourceHash` already matches the current content (so a
 * level/tag edit costs nothing). On `unavailable` / `error` the column is
 * left untouched — a NULL column is what the backfill cron looks for.
 */
export async function ensureGrammarQuiz(rule: {
  id: string;
  groupId: string;
  title: string;
  summary: string;
  explanation: string;
  examples: GrammarExample[];
  level: string | null;
  grammarQuiz: GrammarQuiz | null;
}): Promise<{ generated: boolean }> {
  const sourceHash = grammarSourceHash(rule);
  if (rule.grammarQuiz?.sourceHash === sourceHash) return { generated: false };

  const result = await generateGrammarQuiz({
    title: rule.title,
    summary: rule.summary,
    explanation: rule.explanation,
    examples: rule.examples,
    level: rule.level,
    sourceHash,
  });
  if (result.status !== "ok") return { generated: false };

  await setGrammarQuiz(rule.groupId, rule.id, result.quiz);
  return { generated: true };
}
