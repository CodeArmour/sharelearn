import { listReadingsMissingQuiz } from "@/server/repositories/knowledge";
import { ensureReadingQuiz } from "@/server/services/reading-quiz-service";

const BATCH = 10;

/**
 * Scheduled backfill that generates comprehension quizzes for readings that
 * don't have one yet — existing rows, and any where the AI was unavailable when
 * the reading was saved. Body-change regeneration is handled at edit time, not
 * here. Bounded per run so it stays within the function budget.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. A missing
 * `CRON_SECRET` is a deploy misconfiguration → 503 (fail loud, generate nothing).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await listReadingsMissingQuiz(BATCH);

  let generated = 0;
  for (const row of rows) {
    const result = await ensureReadingQuiz(row);
    if (result.generated) generated += 1;
  }

  return Response.json({ generated });
}
