import "server-only";

import { NotFoundError, ValidationError } from "@/server/errors";
import {
  addReviewMark,
  getStudyRunTotals,
  insertStudyRun,
  listReviewMarks,
  listStudyRuns,
  removeReviewMark,
  replaceReviewMarks,
} from "@/server/repositories/personal";
import { resolveActiveContext } from "@/server/services/session-service";
import type { ReviewMark, StudyHistory, StudyRunInput, StudyRunSummary } from "@/types";

async function requireContext(): Promise<{ userId: string; groupId: string }> {
  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") throw new NotFoundError("No active group");
  return { userId: ctx.user.id, groupId: ctx.activeGroup.id };
}

export async function getReviewMarks(): Promise<ReviewMark[]> {
  const { userId, groupId } = await requireContext();
  return listReviewMarks(userId, groupId);
}

export async function toggleReviewMark(knowledgeId: string): Promise<{ marked: boolean }> {
  const { userId, groupId } = await requireContext();
  const marks = await listReviewMarks(userId, groupId);
  if (marks.some((m) => m.knowledgeId === knowledgeId)) {
    await removeReviewMark(userId, groupId, knowledgeId);
    return { marked: false };
  }
  await addReviewMark(userId, groupId, knowledgeId);
  return { marked: true };
}

export async function importLocalReviewMarks(
  knowledgeIds: string[],
): Promise<{ imported: number }> {
  const { userId, groupId } = await requireContext();
  const unique = [...new Set(knowledgeIds)];
  const imported = await replaceReviewMarks(userId, groupId, unique);
  return { imported };
}

export async function recordStudyRun(input: StudyRunInput): Promise<StudyRunSummary> {
  const { userId, groupId } = await requireContext();

  if (input.correctCount > input.questionCount) {
    throw new ValidationError("correctCount cannot exceed questionCount");
  }
  if ((input.kind === "practice") === (input.mode === null)) {
    throw new ValidationError("practice runs require a mode; exams must not carry one");
  }
  const started = new Date(input.startedAt).getTime();
  const completed = new Date(input.completedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(completed) || started > completed) {
    throw new ValidationError("startedAt is after completedAt");
  }

  const level = input.scope === "level" ? input.level : null;
  return insertStudyRun(userId, groupId, { ...input, level });
}

export async function getStudyHistory(limit = 10): Promise<StudyHistory> {
  const { userId, groupId } = await requireContext();
  const [runs, totals, marks] = await Promise.all([
    listStudyRuns(userId, groupId, limit),
    getStudyRunTotals(userId, groupId),
    listReviewMarks(userId, groupId),
  ]);
  return { runs, totals, markedCount: marks.length };
}
