import { z } from "zod";

import type { GrammarQuiz } from "@/types";

const fillBlankItemSchema = z.object({
  kind: z.literal("fill-blank"),
  prompt: z.string().min(1),
  options: z
    .array(z.string().min(1))
    .length(4)
    .refine((opts) => new Set(opts).size === opts.length, "options must be unique"),
  correctIndex: z.number().int().min(0).max(3),
});

const trueFalseItemSchema = z.object({
  kind: z.literal("true-false"),
  prompt: z.string().min(1),
  correctIndex: z.number().int().min(0).max(1),
});

export const grammarQuizItemSchema = z.discriminatedUnion("kind", [
  fillBlankItemSchema,
  trueFalseItemSchema,
]);

/**
 * What the model must return. `min(2)` guards structure only — a narrow rule
 * that yields 2–3 questions is accepted (the service logs it); fewer than 2
 * fails the parse and is treated as a generation error.
 */
export const grammarQuizGenerationSchema = z.object({
  questions: z.array(grammarQuizItemSchema).min(2).max(8),
});

export type GrammarQuizGeneration = z.infer<typeof grammarQuizGenerationSchema>;

const TRUE_FALSE_OPTIONS = ["Waar", "Onwaar"] as const;

/** Flatten a validated generation into the stored `GrammarQuiz`: assign
 *  question ids, inject the true/false option labels, stamp version + hash +
 *  timestamp. */
export function toGrammarQuiz(
  parsed: GrammarQuizGeneration,
  meta: { promptVersion: string; sourceHash: string },
): GrammarQuiz {
  return {
    promptVersion: meta.promptVersion,
    generatedAt: new Date().toISOString(),
    sourceHash: meta.sourceHash,
    questions: parsed.questions.map((q, i) => ({
      id: `q${i + 1}`,
      kind: q.kind,
      prompt: q.prompt,
      options: q.kind === "fill-blank" ? q.options : [...TRUE_FALSE_OPTIONS],
      correctIndex: q.correctIndex,
    })),
  };
}
