import { z } from "zod";

import { isUuid } from "@/lib/is-uuid";
import { InviteError, isAppError } from "@/server/errors";
import { CEFR_LEVELS, KNOWLEDGE_TYPES } from "@/types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

export const groupIdSchema = z.string().uuid();
export const invitationIdSchema = z.string().uuid();
export const knowledgeItemIdSchema = z.string().uuid();
export const tokenSchema = z.string().min(10);

/** The 6-digit sign-in code from the magic-link email (`{{ .Token }}`). */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from the email");

export const rawKnowledgeTextSchema = z
  .string()
  .trim()
  .min(2, "Paste a little more text")
  .max(10_000, "That is too long to structure at once");

export function toActionError(e: unknown): { code: string; message: string } {
  if (e instanceof InviteError)
    return { code: `invite:${e.inviteCode}`, message: e.message };
  if (isAppError(e)) return { code: e.code, message: e.message };
  return { code: "unknown", message: "Something went wrong" };
}

const tagsSchema = z.array(z.string().trim().min(1)).default([]);
const cefrLevelSchema = z.enum(CEFR_LEVELS).nullable().default(null);
const knowledgeSourceSchema = z.enum(["manual", "photo", "file-upload", "ai-assisted"]);
const nullableText = z.string().trim().min(1).nullable().default(null);

export const createKnowledgeItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vocabulary"),
    level: cefrLevelSchema,
    tags: tagsSchema,
    source: knowledgeSourceSchema,
    term: z.string().trim().min(1),
    meaning: z.string().trim().min(1),
    partOfSpeech: z.string().trim().min(1),
    example: nullableText,
    exampleTranslation: nullableText,
    article: z.enum(["de", "het"]).nullable().default(null),
    plural: nullableText,
    pastTense: nullableText,
    perfect: nullableText,
    usageNote: nullableText,
  }),
  z.object({
    type: z.literal("grammar"),
    level: cefrLevelSchema,
    tags: tagsSchema,
    source: knowledgeSourceSchema,
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
    examples: z
      .array(z.object({ nl: z.string().trim().min(1), en: z.string().trim().min(1).nullable() }))
      .default([]),
  }),
  z.object({
    type: z.literal("reading"),
    level: cefrLevelSchema,
    tags: tagsSchema,
    source: knowledgeSourceSchema,
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    summary: nullableText,
  }),
  z.object({
    type: z.literal("note"),
    level: cefrLevelSchema,
    tags: tagsSchema,
    source: knowledgeSourceSchema,
    title: nullableText,
    body: z.string().trim().min(1),
  }),
]);
export type CreateKnowledgeItemInput = z.infer<typeof createKnowledgeItemSchema>;

export const practiceSetupSchema = z.object({
  mode: z.enum(["vocabulary", "grammar", "reading", "mixed"]),
  scope: z.enum(["all", "today", "level", "custom", "review"]),
  level: z.string().optional(),
  filter: z
    .object({
      q: z.string().optional(),
      type: z.enum(KNOWLEDGE_TYPES).optional(),
      level: z.string().optional(),
      by: z.string().optional(),
    })
    .optional(),
  reviewIds: z
    .array(z.string())
    .transform((ids) => ids.filter(isUuid))
    .optional(),
  length: z.number().int().min(0),
});

export const knowledgeIdsSchema = z.array(z.string()).transform((ids) => ids.filter(isUuid));

export const studyRunInputSchema = z
  .object({
    kind: z.enum(["practice", "exam"]),
    mode: z.enum(["vocabulary", "grammar", "reading", "mixed"]).nullable().default(null),
    scope: z.enum(["all", "today", "level", "custom", "review"]),
    level: z.enum(CEFR_LEVELS).nullable().default(null),
    questionCount: z.number().int().positive(),
    correctCount: z.number().int().min(0),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
  })
  .refine((v) => v.correctCount <= v.questionCount, {
    message: "correctCount cannot exceed questionCount",
    path: ["correctCount"],
  })
  .refine((v) => (v.kind === "practice") !== (v.mode === null), {
    message: "practice runs require a mode; exams must not carry one",
    path: ["mode"],
  });
