import "server-only";

import { getAiProvider } from "@/ai/providers";
import { READING_QUIZ_PROMPT_V1, READING_QUIZ_PROMPT_VERSION } from "@/ai/prompts/reading-quiz";
import { readingQuizGenerationSchema, toReadingQuiz } from "@/ai/schemas/reading-quiz";
import type { ReadingQuiz } from "@/types";

export type ReadingQuizResult =
  | { status: "ok"; quiz: ReadingQuiz }
  | { status: "unavailable" } // no AI_API_KEY
  | { status: "error" }; // provider threw, or output unusable

/** Warn threshold only. Fewer than 3 questions never reaches here —
 *  `readingQuizGenerationSchema.min(3)` fails the parse first and the result is
 *  an `error`. 3–4 questions are kept and stored; we just log a `console.warn`
 *  below `FLOOR` so short passages stay visible. */
const FLOOR = 5;
const MAX_BODY_CHARS = 12_000;

/**
 * Generate a comprehension quiz for one reading passage. Never throws:
 * `unavailable` = no API key, `error` = the model call failed or returned
 * something unusable. `<3` questions (a schema failure) counts as `error`.
 */
export async function generateReadingQuiz(passage: {
  title: string;
  body: string;
  level: string | null;
  sourceHash: string;
}): Promise<ReadingQuizResult> {
  try {
    const provider = getAiProvider();
    if (!provider) return { status: "unavailable" };

    const user = [
      `Title: ${passage.title}`,
      `CEFR level: ${passage.level ?? "unknown"}`,
      `<passage>\n${passage.body.trim().slice(0, MAX_BODY_CHARS)}\n</passage>`,
    ].join("\n");

    const raw = await provider.generateStructured({
      system: READING_QUIZ_PROMPT_V1,
      user,
      schema: readingQuizGenerationSchema,
    });

    const parsed = readingQuizGenerationSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ai:reading-quiz:${READING_QUIZ_PROMPT_VERSION}] schema validation failed`,
        parsed.error.issues,
      );
      return { status: "error" };
    }

    if (parsed.data.questions.length < FLOOR) {
      console.warn(
        `[ai:reading-quiz:${READING_QUIZ_PROMPT_VERSION}] short passage — only ${parsed.data.questions.length} questions`,
      );
    }

    return {
      status: "ok",
      quiz: toReadingQuiz(parsed.data, {
        promptVersion: READING_QUIZ_PROMPT_VERSION,
        sourceHash: passage.sourceHash,
      }),
    };
  } catch (error) {
    console.error(`[ai:reading-quiz:${READING_QUIZ_PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}
