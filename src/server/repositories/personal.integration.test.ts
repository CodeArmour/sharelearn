// @vitest-environment node
import { randomUUID } from "node:crypto";

import { sql, TransactionRollbackError } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "@/server/db/client";
import { NotFoundError } from "@/server/errors";
import { testDb } from "@/test/db";

const run = testDb ? describe : describe.skip;

async function withRolledBackTx(fn: (tx: Db) => Promise<void>): Promise<void> {
  try {
    await testDb!.transaction(async (tx) => {
      await fn(tx as unknown as Db);
      tx.rollback();
    });
  } catch (e) {
    if (!(e instanceof TransactionRollbackError)) throw e;
  }
}

/** One user, one group they own, one live vocabulary item. */
async function seedOne(tx: Db) {
  const userId = randomUUID();
  const groupId = randomUUID();
  await tx.execute(sql`insert into auth.users (id) values (${userId})`);
  await tx.execute(sql`
    insert into groups (id, name, slug, created_by)
    values (${groupId}, 'P3 Test', ${`p3-${groupId.slice(0, 8)}`}, ${userId})
  `);
  await tx.execute(sql`
    insert into group_memberships (group_id, user_id, role) values (${groupId}, ${userId}, 'owner')
  `);
  await tx.execute(sql`
    insert into profiles (id, display_name, initials, accent)
    values (${userId}, 'P3', 'P3', 'vocabulary')
  `);
  const [item] = await tx.execute(sql`
    insert into knowledge_items (group_id, type, source, added_by, term, meaning, part_of_speech)
    values (${groupId}, 'vocabulary', 'manual', ${userId}, 't', 'm', 'p')
    returning id
  `);
  return { userId, groupId, knowledgeId: (item as { id: string }).id };
}

run("personal repository (integration, always rolled back)", () => {
  // The repo module pulls in `@/server/db/client`, which reads server env at
  // import time. Load it lazily inside a hook so `npm test` (no DB env) can
  // skip this suite cleanly instead of exploding on module evaluation — same
  // approach as repositories.integration.test.ts / knowledge.integration.test.ts.
  let repo: typeof import("./personal");

  beforeAll(async () => {
    repo = await import("./personal");
  });

  it("adds, lists and removes a review mark", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId, knowledgeId } = await seedOne(tx);
      await repo.addReviewMark(userId, groupId, knowledgeId, tx);
      await repo.addReviewMark(userId, groupId, knowledgeId, tx); // idempotent
      let marks = await repo.listReviewMarks(userId, groupId, tx);
      expect(marks.map((m) => m.knowledgeId)).toEqual([knowledgeId]);
      await repo.removeReviewMark(userId, groupId, knowledgeId, tx);
      marks = await repo.listReviewMarks(userId, groupId, tx);
      expect(marks).toEqual([]);
    });
  });

  it("addReviewMark rejects an item from another group", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId } = await seedOne(tx);
      await expect(
        repo.addReviewMark(userId, groupId, randomUUID(), tx),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  it("listReviewMarks omits a soft-deleted item", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId, knowledgeId } = await seedOne(tx);
      await repo.addReviewMark(userId, groupId, knowledgeId, tx);
      await tx.execute(sql`update knowledge_items set deleted_at = now() where id = ${knowledgeId}`);
      expect(await repo.listReviewMarks(userId, groupId, tx)).toEqual([]);
    });
  });

  it("replaceReviewMarks is a no-op when the user already has marks", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId, knowledgeId } = await seedOne(tx);
      await repo.addReviewMark(userId, groupId, knowledgeId, tx);
      const n = await repo.replaceReviewMarks(userId, groupId, [randomUUID()], tx);
      expect(n).toBe(0);
      expect((await repo.listReviewMarks(userId, groupId, tx)).length).toBe(1);
    });
  });

  it("inserts a study run and derives score_percent", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId } = await seedOne(tx);
      const runRow = await repo.insertStudyRun(
        userId,
        groupId,
        {
          kind: "practice",
          mode: "mixed",
          scope: "all",
          level: null,
          questionCount: 8,
          correctCount: 6,
          startedAt: "2026-09-01T10:00:00.000Z",
          completedAt: "2026-09-01T10:05:00.000Z",
        },
        tx,
      );
      expect(runRow.scorePercent).toBe(75);
      expect(runRow.mode).toBe("mixed");
    });
  });

  it("totals average across runs; newest-first list respects the limit", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId } = await seedOne(tx);
      const mk = (correct: number, completedAt: string) =>
        repo.insertStudyRun(
          userId,
          groupId,
          {
            kind: "exam",
            mode: null,
            scope: "all",
            level: null,
            questionCount: 10,
            correctCount: correct,
            startedAt: completedAt,
            completedAt,
          },
          tx,
        );
      await mk(5, "2026-09-01T10:00:00.000Z");
      await mk(9, "2026-09-03T10:00:00.000Z");
      const totals = await repo.getStudyRunTotals(userId, groupId, tx);
      expect(totals.runCount).toBe(2);
      expect(totals.avgScorePercent).toBe(70); // (50 + 90) / 2
      const list = await repo.listStudyRuns(userId, groupId, 1, tx);
      expect(list).toHaveLength(1);
      expect(list[0].correctCount).toBe(9); // newest
    });
  });

  it("RLS: the owner sees their study run; another authenticated user does not", async () => {
    await withRolledBackTx(async (tx) => {
      const { userId, groupId } = await seedOne(tx);
      // Seed the outsider's auth.users row up front — the `authenticated` role
      // lacks INSERT on auth.users once we switch to it below.
      const outsider = randomUUID();
      await tx.execute(sql`insert into auth.users (id) values (${outsider})`);
      const inserted = await repo.insertStudyRun(
        userId,
        groupId,
        { kind: "practice", mode: "mixed", scope: "all", level: null, questionCount: 4, correctCount: 4, startedAt: "2026-09-01T10:00:00.000Z", completedAt: "2026-09-01T10:01:00.000Z" },
        tx,
      );

      // Positive control: as the owner (authenticated role + their JWT sub) RLS
      // must expose exactly the row just inserted. Without this, the
      // toHaveLength(0) below would also pass if auth.uid() were NULL / RLS off.
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
      const asOwner = await tx.execute(sql`select id from study_runs`);
      expect(asOwner).toHaveLength(1);
      expect((asOwner[0] as { id: string }).id).toBe(inserted.id);

      // Now act as an unrelated authenticated user: the row must be invisible.
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${outsider}, true)`);
      const visible = await tx.execute(sql`select id from study_runs`);
      expect(visible).toHaveLength(0);
    });
  });
});
