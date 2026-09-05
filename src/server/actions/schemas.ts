import { z } from "zod";

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

export function toActionError(e: unknown): { code: string; message: string } {
  if (e instanceof InviteError)
    return { code: `invite:${e.inviteCode}`, message: e.message };
  if (isAppError(e)) return { code: e.code, message: e.message };
  return { code: "unknown", message: "Something went wrong" };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pre-Phase-2 mock ids (e.g. `kn_gezellig`) can still be sitting in a
 * client's `localStorage` review marks — filter them out instead of
 * rejecting the whole array, so stale legacy ids don't fail every call. */
function isUuidString(value: string): boolean {
  return UUID_RE.test(value);
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
    .transform((ids) => ids.filter(isUuidString))
    .optional(),
  length: z.number().int().min(0),
});

export const knowledgeIdsSchema = z.array(z.string()).transform((ids) => ids.filter(isUuidString));
