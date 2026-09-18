import "server-only";

import { getAiProvider } from "@/ai/providers";
import { GRAMMAR_QUIZ_PROMPT_V1, GRAMMAR_QUIZ_PROMPT_VERSION } from "@/ai/prompts/grammar-quiz";
import { grammarQuizGenerationSchema, toGrammarQuiz } from "@/ai/schemas/grammar-quiz";
import type { GrammarExample, GrammarQuiz } from "@/types";

export type GrammarQuizResult =
  | { status: "ok"; quiz: GrammarQuiz }
  | { status: "unavailable" } // no AI_API_KEY
  | { status: "error" }; // provider threw, or output unusable

/** Warn threshold only. Fewer than 2 questions never reaches here —
 *  `grammarQuizGenerationSchema.min(2)` fails the parse first and the result
 *  is an `error`. 2–3 questions are kept and stored; we just log a
 *  `console.warn` below `FLOOR` so thin rules stay visible. */
const FLOOR = 4;

/**
 * Generate grammar questions for one rule. Never throws: `unavailable` = no
 * API key, `error` = the model call failed or returned something unusable.
 * `<2` questions (a schema failure) counts as `error`.
 */
export async function generateGrammarQuiz(rule: {
  title: string;
  summary: string;
  explanation: string;
  examples: GrammarExample[];
  level: string | null;
  sourceHash: string;
}): Promise<GrammarQuizResult> {
  try {
    const provider = getAiProvider();
    if (!provider) return { status: "unavailable" };

    const user = [
      `Title: ${rule.title}`,
      `CEFR level: ${rule.level ?? "unknown"}`,
      `<rule>`,
      `Summary: ${rule.summary}`,
      `Explanation: ${rule.explanation}`,
      ...rule.examples.map(
        (ex, i) => `Example ${i + 1}: ${ex.nl}${ex.en ? ` (${ex.en})` : ""}`,
      ),
      `</rule>`,
    ].join("\n");

    const raw = await provider.generateStructured({
      system: GRAMMAR_QUIZ_PROMPT_V1,
      user,
      schema: grammarQuizGenerationSchema,
    });

    const parsed = grammarQuizGenerationSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ai:grammar-quiz:${GRAMMAR_QUIZ_PROMPT_VERSION}] schema validation failed`,
        parsed.error.issues,
      );
      return { status: "error" };
    }

    if (parsed.data.questions.length < FLOOR) {
      console.warn(
        `[ai:grammar-quiz:${GRAMMAR_QUIZ_PROMPT_VERSION}] thin rule — only ${parsed.data.questions.length} questions`,
      );
    }

    return {
      status: "ok",
      quiz: toGrammarQuiz(parsed.data, {
        promptVersion: GRAMMAR_QUIZ_PROMPT_VERSION,
        sourceHash: rule.sourceHash,
      }),
    };
  } catch (error) {
    console.error(`[ai:grammar-quiz:${GRAMMAR_QUIZ_PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}
