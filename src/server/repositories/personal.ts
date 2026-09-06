import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, type Db } from "@/server/db/client";
import { NotFoundError } from "@/server/errors";
import {
  knowledgeItems,
  reviewMarks,
  studyRuns,
  type StudyRunRow,
} from "@/server/db/schema";
import type { CEFRLevel, PracticeMode, PracticeScope, ReviewMark, StudyRunInput, StudyRunSummary } from "@/types";

function mapStudyRun(row: StudyRunRow): StudyRunSummary {
  return {
    id: row.id,
    kind: row.kind,
    mode: row.mode as PracticeMode | null,
    scope: row.scope as PracticeScope,
    level: row.level as CEFRLevel | null,
    questionCount: row.questionCount,
    correctCount: row.correctCount,
    // question_count > 0 is guaranteed by the CHECK constraint.
    scorePercent: Math.round((row.correctCount / row.questionCount) * 100),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
  };
}

/** True when the id names a live (not soft-deleted) item in the group. */
async function itemIsInGroup(
  executor: Db,
  groupId: string,
  knowledgeId: string,
): Promise<boolean> {
  const rows = await executor
    .select({ id: knowledgeItems.id })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.id, knowledgeId),
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function listReviewMarks(
  userId: string,
  groupId: string,
  executor: Db = db,
): Promise<ReviewMark[]> {
  const rows = await executor
    .select({ knowledgeId: reviewMarks.knowledgeId, markedAt: reviewMarks.markedAt })
    .from(reviewMarks)
    .innerJoin(knowledgeItems, eq(knowledgeItems.id, reviewMarks.knowledgeId))
    .where(
      and(
        eq(reviewMarks.userId, userId),
        eq(reviewMarks.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .orderBy(desc(reviewMarks.markedAt));
  return rows.map((r) => ({ knowledgeId: r.knowledgeId, markedAt: r.markedAt.toISOString() }));
}

export async function addReviewMark(
  userId: string,
  groupId: string,
  knowledgeId: string,
  executor: Db = db,
): Promise<void> {
  if (!(await itemIsInGroup(executor, groupId, knowledgeId))) {
    throw new NotFoundError("Knowledge item not found");
  }
  await executor
    .insert(reviewMarks)
    .values({ userId, groupId, knowledgeId })
    .onConflictDoNothing();
}

export async function removeReviewMark(
  userId: string,
  groupId: string,
  knowledgeId: string,
  executor: Db = db,
): Promise<void> {
  await executor
    .delete(reviewMarks)
    .where(
      and(
        eq(reviewMarks.userId, userId),
        eq(reviewMarks.groupId, groupId),
        eq(reviewMarks.knowledgeId, knowledgeId),
      ),
    );
}

export async function replaceReviewMarks(
  userId: string,
  groupId: string,
  knowledgeIds: string[],
  executor: Db = db,
): Promise<number> {
  if (knowledgeIds.length === 0) return 0;
  return executor.transaction(async (tx) => {
    const existing = await tx
      .select({ one: sql<number>`1` })
      .from(reviewMarks)
      .where(and(eq(reviewMarks.userId, userId), eq(reviewMarks.groupId, groupId)))
      .limit(1);
    if (existing.length > 0) return 0; // server-wins

    const live = await tx
      .select({ id: knowledgeItems.id })
      .from(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.groupId, groupId),
          isNull(knowledgeItems.deletedAt),
          inArray(knowledgeItems.id, knowledgeIds),
        ),
      );
    if (live.length === 0) return 0;

    await tx
      .insert(reviewMarks)
      .values(live.map((r) => ({ userId, groupId, knowledgeId: r.id })))
      .onConflictDoNothing();
    return live.length;
  });
}

export async function insertStudyRun(
  userId: string,
  groupId: string,
  input: StudyRunInput,
  executor: Db = db,
): Promise<StudyRunSummary> {
  const [row] = await executor
    .insert(studyRuns)
    .values({
      userId,
      groupId,
      kind: input.kind,
      mode: input.mode,
      scope: input.scope,
      level: input.level,
      questionCount: input.questionCount,
      correctCount: input.correctCount,
      startedAt: new Date(input.startedAt),
      completedAt: new Date(input.completedAt),
    })
    .returning();
  return mapStudyRun(row);
}

export async function listStudyRuns(
  userId: string,
  groupId: string,
  limit: number,
  executor: Db = db,
): Promise<StudyRunSummary[]> {
  const rows = await executor
    .select()
    .from(studyRuns)
    .where(and(eq(studyRuns.userId, userId), eq(studyRuns.groupId, groupId)))
    .orderBy(desc(studyRuns.completedAt))
    .limit(limit);
  return rows.map(mapStudyRun);
}

export async function getStudyRunTotals(
  userId: string,
  groupId: string,
  executor: Db = db,
): Promise<{ runCount: number; avgScorePercent: number }> {
  const [row] = await executor
    .select({
      runCount: sql<number>`count(*)::int`,
      avgScorePercent: sql<number>`coalesce(round(avg(${studyRuns.correctCount}::numeric / ${studyRuns.questionCount} * 100)), 0)::int`,
    })
    .from(studyRuns)
    .where(and(eq(studyRuns.userId, userId), eq(studyRuns.groupId, groupId)));
  return { runCount: row.runCount, avgScorePercent: row.avgScorePercent };
}
