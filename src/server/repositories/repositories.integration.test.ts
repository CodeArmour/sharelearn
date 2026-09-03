// @vitest-environment node
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { groups } from "@/server/db/schema";
import { resetTables, testDb } from "@/test/db";

const run = testDb ? describe : describe.skip;

run("repositories (integration)", () => {
  // Repo modules pull in `@/server/db/client`, which reads server env at import
  // time. Load them lazily inside a hook so `npm test` (no DB env) can skip this
  // suite cleanly instead of exploding on module evaluation.
  let groupsRepo: typeof import("./groups");
  let membershipsRepo: typeof import("./memberships");
  let invitesRepo: typeof import("./invitations");
  let profilesRepo: typeof import("./profiles");

  const owner = randomUUID();
  // Every synthetic auth.users id this suite creates — cleaned up exactly.
  const createdUserIds = new Set<string>();

  async function seedAuthUser(id: string): Promise<void> {
    createdUserIds.add(id);
    // Idempotent: `resetTables()` only truncates the public tables, so an
    // auth.users row seeded by an earlier test is still present here.
    await testDb!.execute(
      sql`INSERT INTO auth.users (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`,
    );
  }

  beforeAll(async () => {
    groupsRepo = await import("./groups");
    membershipsRepo = await import("./memberships");
    invitesRepo = await import("./invitations");
    profilesRepo = await import("./profiles");
  });

  beforeEach(async () => {
    await resetTables();
    // Seed an auth.users row the FKs can point at.
    await seedAuthUser(owner);
  });

  afterAll(async () => {
    await resetTables();
    // Deleting the auth user cascades to profiles / group_memberships.
    const ids = [...createdUserIds];
    if (ids.length > 0) {
      await testDb!.execute(
        sql`DELETE FROM auth.users WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }
  });

  it("creates a group + owner membership and lists them", async () => {
    const [group] = await testDb!
      .insert(groups)
      .values({ name: "Test", slug: `test-${owner.slice(0, 8)}`, createdBy: owner })
      .returning();

    await profilesRepo.upsertProfile(testDb!, {
      userId: owner,
      displayName: "Owner",
      initials: "OW",
      accent: "vocabulary",
    });
    await membershipsRepo.createMembership(testDb!, {
      groupId: group.id,
      userId: owner,
      role: "owner",
    });

    const forUser = await groupsRepo.listGroupsForUser(owner);
    expect(forUser).toEqual([
      { id: group.id, name: "Test", slug: group.slug, role: "owner" },
    ]);

    const members = await membershipsRepo.listMembers(group.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ id: owner, name: "Owner", role: "owner" });

    expect(await membershipsRepo.getRole(owner, group.id)).toBe("owner");
  });

  it("round-trips an invitation by token", async () => {
    const [group] = await testDb!
      .insert(groups)
      .values({ name: "T2", slug: `t2-${owner.slice(0, 8)}`, createdBy: owner })
      .returning();

    const token = randomUUID();
    await invitesRepo.createInvitation(testDb!, {
      groupId: group.id,
      email: "Invitee@Example.com",
      token,
      role: "member",
      invitedBy: owner,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const byToken = await invitesRepo.getByToken(token);
    expect(byToken?.status).toBe("pending");
    // citext: lookup is case-insensitive
    expect(await invitesRepo.getPendingByEmail("invitee@example.com")).toHaveLength(1);
  });
});
