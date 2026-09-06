"use server";

import { revalidatePath } from "next/cache";

import {
  getReviewMarks,
  importLocalReviewMarks,
  recordStudyRun,
  toggleReviewMark,
} from "@/server/services/personal-service";
import type { ReviewMark, StudyRunInput, StudyRunSummary } from "@/types";

import {
  knowledgeIdsSchema,
  knowledgeItemIdSchema,
  studyRunInputSchema,
  toActionError,
  type ActionResult,
} from "./schemas";

export async function getReviewMarksAction(): Promise<ActionResult<ReviewMark[]>> {
  try {
    return { ok: true, data: await getReviewMarks() };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function toggleReviewMarkAction(
  knowledgeId: unknown,
): Promise<ActionResult<{ marked: boolean }>> {
  const parsed = knowledgeItemIdSchema.safeParse(knowledgeId);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid id" };
  try {
    const data = await toggleReviewMark(parsed.data);
    revalidatePath("/profile");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function importLocalReviewMarksAction(
  ids: unknown,
): Promise<ActionResult<{ imported: number }>> {
  const parsed = knowledgeIdsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid ids" };
  try {
    const data = await importLocalReviewMarks(parsed.data);
    if (data.imported > 0) revalidatePath("/profile");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function recordStudyRunAction(
  input: unknown,
): Promise<ActionResult<StudyRunSummary>> {
  const parsed = studyRunInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid study run" };
  try {
    const data = await recordStudyRun(parsed.data as StudyRunInput);
    revalidatePath("/profile");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}
