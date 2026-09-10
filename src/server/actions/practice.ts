"use server";

import { generateExamQuestions, generatePracticeQuestions } from "@/server/services/practice-service";
import type { PracticeQuestion } from "@/types";

import { getKnowledgeItemById } from "@/server/repositories/knowledge";
import { ensureReadingQuiz } from "@/server/services/reading-quiz-service";
import { resolveActiveContext } from "@/server/services/session-service";
import {
  knowledgeItemIdSchema,
  practiceSetupSchema,
  toActionError,
  type ActionResult,
} from "./schemas";

export async function generatePracticeQuestionsAction(
  setup: unknown,
): Promise<ActionResult<PracticeQuestion[]>> {
  const parsed = practiceSetupSchema.safeParse(setup);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid practice setup" };
  try {
    return { ok: true, data: await generatePracticeQuestions(parsed.data) };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function generateExamQuestionsAction(
  setup: unknown,
): Promise<ActionResult<PracticeQuestion[]>> {
  const parsed = practiceSetupSchema.safeParse(setup);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid exam setup" };
  try {
    return { ok: true, data: await generateExamQuestions(parsed.data) };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

/**
 * Ensure a reading passage has an up-to-date comprehension quiz. Fired
 * fire-and-forget by the Add / edit views after a reading is saved. Gated on an
 * active group so an unauthenticated caller can't reach the model. A non-reading
 * or missing id is a no-op, not an error — callers fire without knowing types.
 */
export async function generateReadingQuizAction(
  readingId: unknown,
): Promise<ActionResult<{ generated: boolean }>> {
  const parsed = knowledgeItemIdSchema.safeParse(readingId);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid id" };

  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") {
    return { ok: false, code: "unauthorized", message: "Sign in to generate reading questions" };
  }

  try {
    const item = await getKnowledgeItemById(ctx.activeGroup.id, parsed.data);
    if (!item || item.type !== "reading") return { ok: true, data: { generated: false } };
    const result = await ensureReadingQuiz({
      id: item.id,
      groupId: ctx.activeGroup.id,
      title: item.title,
      body: item.body,
      level: item.level,
      readingQuiz: item.readingQuiz,
    });
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}
