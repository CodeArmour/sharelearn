import "server-only";

import { generateReadingQuiz } from "@/ai/services/reading-quiz";
import { readingBodyHash } from "@/lib/reading-quiz-hash";
import { setReadingQuiz } from "@/server/repositories/knowledge";
import type { ReadingQuiz } from "@/types";

/**
 * Make sure a reading has an up-to-date comprehension quiz. Fast-paths when the
 * stored quiz's `sourceHash` already matches the current body (so a title/level
 * edit costs nothing). On `unavailable` / `error` the column is left untouched —
 * a NULL column is what the backfill cron looks for.
 */
export async function ensureReadingQuiz(reading: {
  id: string;
  groupId: string;
  title: string;
  body: string;
  level: string | null;
  readingQuiz: ReadingQuiz | null;
}): Promise<{ generated: boolean }> {
  const sourceHash = readingBodyHash(reading.body);
  if (reading.readingQuiz?.sourceHash === sourceHash) return { generated: false };

  const result = await generateReadingQuiz({
    title: reading.title,
    body: reading.body,
    level: reading.level,
    sourceHash,
  });
  if (result.status !== "ok") return { generated: false };

  await setReadingQuiz(reading.groupId, reading.id, result.quiz);
  return { generated: true };
}
