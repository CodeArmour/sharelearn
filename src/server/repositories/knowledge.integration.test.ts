// @vitest-environment node
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { groups } from "@/server/db/schema";
import { resetTables, testDb } from "@/test/db";

const run = testDb ? describe : describe.skip;

run("knowledge repository (integration)", () => {
  let repo: typeof import("./knowledge");
  let profilesRepo: typeof import("./profiles");

  const owner = randomUUID();
  const createdUserIds = new Set<string>();

  async function seedAuthUser(id: string): Promise<void> {
    createdUserIds.add(id);
    await testDb!.execute(
      sql`INSERT INTO auth.users (id) VALUES (${id}) ON CONFLICT (id) DO NOTHING`,
    );
  }

  beforeAll(async () => {
    repo = await import("./knowledge");
    profilesRepo = await import("./profiles");
  });

  beforeEach(async () => {
    await resetTables();
    await seedAuthUser(owner);
    await profilesRepo.upsertProfile(testDb!, {
      userId: owner,
      displayName: "Owner",
      initials: "OW",
      accent: "vocabulary",
    });
  });

  afterAll(async () => {
    await resetTables();
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

  async function makeGroup(name: string) {
    const [group] = await testDb!
      .insert(groups)
      .values({ name, slug: `${name.toLowerCase()}-${owner.slice(0, 6)}`, createdBy: owner })
      .returning();
    return group;
  }

  it("inserts a vocabulary item and reads it back shaped as KnowledgeItem", async () => {
    const group = await makeGroup("G1");

    const created = await repo.insertKnowledgeItem(testDb!, {
      groupId: group.id,
      type: "vocabulary",
      level: "B1",
      tags: ["uitdrukking"],
      source: "manual",
      addedBy: owner,
      term: "rekening houden met",
      meaning: "to take into account",
      partOfSpeech: "Uitdrukking",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });

    expect(created).toMatchObject({
      type: "vocabulary",
      term: "rekening houden met",
      addedBy: { id: owner, name: "Owner" },
    });

    const byId = await repo.getKnowledgeItemById(group.id, created.id);
    expect(byId).toMatchObject({ id: created.id, term: "rekening houden met" });

    // Not visible from a different group.
    const otherGroup = await makeGroup("G2");
    expect(await repo.getKnowledgeItemById(otherGroup.id, created.id)).toBeNull();
  });

  it("filters listKnowledgeItems by type, level and search", async () => {
    const group = await makeGroup("G3");
    await repo.insertKnowledgeItem(testDb!, {
      groupId: group.id,
      type: "vocabulary",
      level: "A2",
      tags: [],
      source: "manual",
      addedBy: owner,
      term: "gezellig",
      meaning: "cozy",
      partOfSpeech: "Bijvoeglijk naamwoord",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    await repo.insertKnowledgeItem(testDb!, {
      groupId: group.id,
      type: "note",
      level: null,
      tags: [],
      source: "manual",
      addedBy: owner,
      title: null,
      body: "Onthoud: de g klinkt anders dan de ch.",
    });

    expect(await repo.listKnowledgeItems(group.id, { type: "note" })).toHaveLength(1);
    expect(await repo.listKnowledgeItems(group.id, { level: "A2" })).toHaveLength(1);
    expect(await repo.listKnowledgeItems(group.id, { search: "gezellig" })).toHaveLength(1);
    expect(await repo.listKnowledgeItems(group.id, { search: "nothing-matches" })).toHaveLength(0);
    expect(await repo.listKnowledgeItems(group.id)).toHaveLength(2);
    // File type is not supported in this phase; should return empty even when group has items
    expect(await repo.listKnowledgeItems(group.id, { type: "file" })).toHaveLength(0);
  });

  it("getKnowledgeStats and getDistinctLevels", async () => {
    const group = await makeGroup("G4");
    await repo.insertKnowledgeItem(testDb!, {
      groupId: group.id,
      type: "note",
      level: "B2",
      tags: [],
      source: "manual",
      addedBy: owner,
      title: null,
      body: "x",
    });
    await repo.insertKnowledgeItem(testDb!, {
      groupId: group.id,
      type: "note",
      level: null,
      tags: [],
      source: "manual",
      addedBy: owner,
      title: null,
      body: "y",
    });

    expect(await repo.getKnowledgeStats(group.id)).toEqual([{ type: "note", count: 2 }]);
    expect(await repo.getDistinctLevels(group.id)).toEqual(["B2"]);
  });
});
