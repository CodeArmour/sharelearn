"use server";

import { generateExamQuestions, generatePracticeQuestions } from "@/server/services/practice-service";
import type { PracticeQuestion } from "@/types";

import { practiceSetupSchema, toActionError, type ActionResult } from "./schemas";

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
