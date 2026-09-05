// @vitest-environment node
import { randomUUID } from "node:crypto";

import { sql, TransactionRollbackError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { Db } from "@/server/db/client";
import { testDb } from "@/test/db";

const run = testDb ? describe : describe.skip;

/**
 * RLS smoke tests. Unlike this suite's siblings
 * (repositories.integration.test.ts, knowledge.integration.test.ts), these
 * never commit: every test builds its own fixtures and makes its assertions
 * inside one transaction, then always rolls it back. That makes this file
 * safe to run against a live/shared database -- nothing it does can leave a
 * trace, regardless of what TEST_DATABASE_URL points at.
 *
 * The app itself always connects as the table owner (via the pooler), which
 * bypasses RLS entirely -- these are the only tests in the project that
 * actually exercise the policies as the `authenticated` Postgres role.
 */

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

interface TwoGroupFixture {
  userA: string;
  userB: string;
  groupA: string;
  groupB: string;
}

/** Two users, two groups, each user the sole owner of their own group. */
async function seedTwoGroups(tx: Db): Promise<TwoGroupFixture> {
  const userA = randomUUID();
  const userB = randomUUID();
  const groupA = randomUUID();
  const groupB = randomUUID();

  await tx.execute(sql`insert into auth.users (id) values (${userA}), (${userB})`);
  await tx.execute(sql`
    insert into groups (id, name, slug, created_by) values
      (${groupA}, 'RLS Test A', ${`rls-a-${groupA.slice(0, 8)}`}, ${userA}),
      (${groupB}, 'RLS Test B', ${`rls-b-${groupB.slice(0, 8)}`}, ${userB})
  `);
  await tx.execute(sql`
    insert into group_memberships (group_id, user_id, role) values
      (${groupA}, ${userA}, 'owner'),
      (${groupB}, ${userB}, 'owner')
  `);

  return { userA, userB, groupA, groupB };
}

/** Switch the current transaction to act as `userId`, the way a real
 * PostgREST/Supabase request would via the caller's JWT. */
async function actAs(tx: Db, userId: string): Promise<void> {
  await tx.execute(sql`set local role authenticated`);
  await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
}

run("row level security (integration, always rolled back)", () => {
  it("groups: a member sees only their own group", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA, groupB } = await seedTwoGroups(tx);
      await actAs(tx, userA);

      const visible = await tx.execute(sql`select id from groups`);
      const ids = visible.map((r) => (r as { id: string }).id);
      expect(ids).toContain(groupA);
      expect(ids).not.toContain(groupB);
    });
  });

  it("group_memberships: a member sees only their own group's membership rows", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA, groupB } = await seedTwoGroups(tx);
      await actAs(tx, userA);

      const visible = await tx.execute(sql`select group_id from group_memberships`);
      const groupIds = visible.map((r) => (r as { group_id: string }).group_id);
      expect(groupIds).toContain(groupA);
      expect(groupIds).not.toContain(groupB);
    });
  });

  it("knowledge_items: a member sees only their own group's items", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, userB, groupA, groupB } = await seedTwoGroups(tx);
      await tx.execute(sql`
        insert into knowledge_items (group_id, type, source, added_by, title, body) values
          (${groupA}, 'note', 'manual', ${userA}, 'A note', 'body A'),
          (${groupB}, 'note', 'manual', ${userB}, 'B note', 'body B')
      `);
      await actAs(tx, userA);

      const visible = await tx.execute(sql`select group_id from knowledge_items`);
      const groupIds = visible.map((r) => (r as { group_id: string }).group_id);
      expect(groupIds).toContain(groupA);
      expect(groupIds).not.toContain(groupB);
    });
  });

  it("knowledge_items: a non-member cannot insert into someone else's group", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupB } = await seedTwoGroups(tx);
      await actAs(tx, userA);

      await expect(
        tx.execute(sql`
          insert into knowledge_items (group_id, type, source, added_by, title, body)
          values (${groupB}, 'note', 'manual', ${userA}, 'sneaky', 'sneaky body')
        `),
      ).rejects.toThrow();
    });
  });

  it("knowledge_items: a member can insert into their own group", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA } = await seedTwoGroups(tx);
      await actAs(tx, userA);

      const inserted = await tx.execute(sql`
        insert into knowledge_items (group_id, type, source, added_by, title, body)
        values (${groupA}, 'note', 'manual', ${userA}, 'ok', 'ok body')
        returning id
      `);
      expect(inserted).toHaveLength(1);
    });
  });

  it("invitations: only the group owner can see its pending invitations", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, userB, groupA } = await seedTwoGroups(tx);
      await tx.execute(sql`
        insert into invitations (group_id, email, token, role, invited_by, expires_at)
        values (${groupA}, 'invitee@example.com', ${randomUUID()}, 'member', ${userA}, now() + interval '7 days')
      `);

      await actAs(tx, userA);
      const asOwner = await tx.execute(sql`select id from invitations where group_id = ${groupA}`);
      expect(asOwner).toHaveLength(1);

      await actAs(tx, userB);
      const asOutsider = await tx.execute(
        sql`select id from invitations where group_id = ${groupA}`,
      );
      expect(asOutsider).toHaveLength(0);
    });
  });

  it("knowledge_items: the author can update their own item; a different member cannot", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA } = await seedTwoGroups(tx);
      const [item] = await tx.execute(sql`
        insert into knowledge_items (group_id, type, source, added_by, title, body)
        values (${groupA}, 'note', 'manual', ${userA}, 'orig', 'orig body')
        returning id
      `);
      const itemId = (item as { id: string }).id;

      // A second member, not the author and not the owner of groupA, added to groupA as a
      // plain member. Seeded here, before switching to the `authenticated` role below, since
      // that role lacks INSERT on auth.users.
      const outsider = randomUUID();
      await tx.execute(sql`insert into auth.users (id) values (${outsider})`);
      await tx.execute(sql`
        insert into group_memberships (group_id, user_id, role) values (${groupA}, ${outsider}, 'member')
      `);

      await actAs(tx, userA);
      const updated = await tx.execute(sql`
        update knowledge_items set body = 'edited by author' where id = ${itemId} returning id
      `);
      expect(updated).toHaveLength(1);

      await actAs(tx, outsider);
      const rejected = await tx.execute(sql`
        update knowledge_items set body = 'sneaky edit' where id = ${itemId} returning id
      `);
      expect(rejected).toHaveLength(0);
    });
  });

  it("knowledge_items: the group owner can update someone else's item", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA } = await seedTwoGroups(tx);
      const member = randomUUID();
      await tx.execute(sql`insert into auth.users (id) values (${member})`);
      await tx.execute(sql`
        insert into group_memberships (group_id, user_id, role) values (${groupA}, ${member}, 'member')
      `);
      const [item] = await tx.execute(sql`
        insert into knowledge_items (group_id, type, source, added_by, title, body)
        values (${groupA}, 'note', 'manual', ${member}, 'orig', 'orig body')
        returning id
      `);
      const itemId = (item as { id: string }).id;

      // userA is groupA's owner (seedTwoGroups makes the group's creator its owner).
      await actAs(tx, userA);
      const updated = await tx.execute(sql`
        update knowledge_items set body = 'edited by owner' where id = ${itemId} returning id
      `);
      expect(updated).toHaveLength(1);
    });
  });
});
