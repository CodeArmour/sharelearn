import { z } from "zod";

import type { ReadingQuiz } from "@/types";

const mcqItemSchema = z.object({
  kind: z.literal("mcq"),
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

export const readingQuizItemSchema = z.discriminatedUnion("kind", [
  mcqItemSchema,
  trueFalseItemSchema,
]);

/**
 * What the model must return. `min(3)` guards structure only — a short passage
 * that yields 3–4 questions is accepted (the service logs it); fewer than 3
 * fails the parse and is treated as a generation error.
 */
export const readingQuizGenerationSchema = z.object({
  questions: z.array(readingQuizItemSchema).min(3).max(10),
});

export type ReadingQuizGeneration = z.infer<typeof readingQuizGenerationSchema>;

const TRUE_FALSE_OPTIONS = ["Waar", "Onwaar"] as const;

/** Flatten a validated generation into the stored `ReadingQuiz`: assign question
 *  ids, inject the true/false option labels, stamp version + hash + timestamp. */
export function toReadingQuiz(
  parsed: ReadingQuizGeneration,
  meta: { promptVersion: string; sourceHash: string },
): ReadingQuiz {
  return {
    promptVersion: meta.promptVersion,
    generatedAt: new Date().toISOString(),
    sourceHash: meta.sourceHash,
    questions: parsed.questions.map((q, i) => ({
      id: `q${i + 1}`,
      kind: q.kind,
      prompt: q.prompt,
      options: q.kind === "mcq" ? q.options : [...TRUE_FALSE_OPTIONS],
      correctIndex: q.correctIndex,
    })),
  };
}
