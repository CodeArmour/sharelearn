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
/** Grammar explanations are far shorter than reading passages, but clamp
 *  each interpolated field anyway — mirrors reading-quiz's MAX_BODY_CHARS. */
const MAX_INPUT_CHARS = 4_000;

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
      `Summary: ${rule.summary.slice(0, MAX_INPUT_CHARS)}`,
      `Explanation: ${rule.explanation.slice(0, MAX_INPUT_CHARS)}`,
      ...rule.examples.map((ex, i) => {
        const nl = ex.nl.slice(0, MAX_INPUT_CHARS);
        const en = ex.en ? ex.en.slice(0, MAX_INPUT_CHARS) : "";
        return `Example ${i + 1}: ${nl}${en ? ` (${en})` : ""}`;
      }),
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
