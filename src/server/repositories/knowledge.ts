import "server-only";

import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { isUuid } from "@/lib/is-uuid";
import { db, type Db } from "@/server/db/client";
import {
  knowledgeItems,
  profiles,
  type KnowledgeItemRow,
  type NewKnowledgeItemRow,
} from "@/server/db/schema";
import type { CEFRLevel, KnowledgeItem, KnowledgeType, ReadingQuiz, UserSummary } from "@/types";

export interface KnowledgeListFilter {
  type?: KnowledgeType;
  level?: string;
  addedBy?: string;
  search?: string;
  ids?: string[];
}

const SEARCH_COLUMNS = [
  knowledgeItems.term,
  knowledgeItems.meaning,
  knowledgeItems.title,
  knowledgeItems.summary,
  knowledgeItems.explanation,
  knowledgeItems.body,
] as const;

const updatedByProfiles = alias(profiles, "updated_by_profiles");

/** Row + joined attribution → the frontend's `KnowledgeItem` discriminated union. */
function mapRow(
  row: KnowledgeItemRow,
  addedBy: UserSummary,
  updatedBy: UserSummary | null,
): KnowledgeItem {
  const base = {
    id: row.id,
    level: row.level as CEFRLevel | null,
    tags: row.tags,
    source: row.source,
    addedBy,
    updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  switch (row.type) {
    case "vocabulary":
      return {
        ...base,
        type: "vocabulary",
        term: row.term!,
        meaning: row.meaning!,
        partOfSpeech: row.partOfSpeech!,
        example: row.example,
        exampleTranslation: row.exampleTranslation,
        article: row.article,
        plural: row.plural,
        pastTense: row.pastTense,
        perfect: row.perfect,
        usageNote: row.usageNote,
      };
    case "grammar":
      return {
        ...base,
        type: "grammar",
        title: row.title!,
        summary: row.summary!,
        explanation: row.explanation!,
        examples: row.examples ?? [],
      };
    case "reading":
      return {
        ...base,
        type: "reading",
        title: row.title!,
        body: row.body!,
        wordCount: row.wordCount ?? 0,
        summary: row.summary,
        vocabularyIds: row.vocabularyIds ?? [],
        readingQuiz: row.readingQuiz ?? null,
      };
    case "note":
      return {
        ...base,
        type: "note",
        title: row.title,
        body: row.body!,
      };
  }
}

function toUserSummary(p: {
  id: string;
  displayName: string;
  initials: string;
  accent: string;
}): UserSummary {
  return {
    id: p.id,
    name: p.displayName,
    initials: p.initials,
    accent: p.accent as UserSummary["accent"],
    avatarUrl: null,
  };
}

function buildFilter(groupId: string, filter: KnowledgeListFilter = {}) {
  const clauses = [eq(knowledgeItems.groupId, groupId), isNull(knowledgeItems.deletedAt)];
  // Note: caller must handle type: "file" case since DB enum doesn't support it
  if (filter.type && filter.type !== "file") {
    clauses.push(eq(knowledgeItems.type, filter.type));
  }
  if (filter.level) clauses.push(eq(knowledgeItems.level, filter.level));
  if (filter.addedBy && isUuid(filter.addedBy))
    clauses.push(eq(knowledgeItems.addedBy, filter.addedBy));
  if (filter.ids) clauses.push(inArray(knowledgeItems.id, filter.ids));
  if (filter.search) {
    const pattern = `%${filter.search}%`;
    // SEARCH_COLUMNS is a fixed 6-element array, so the non-null assertion is safe
    clauses.push(or(...SEARCH_COLUMNS.map((col) => ilike(col, pattern)))!);
  }
  return and(...clauses);
}

async function selectWithAttribution(
  where: ReturnType<typeof and>,
  executor: Db = db,
): Promise<KnowledgeItem[]> {
  const rows = await executor
    .select({
      item: knowledgeItems,
      profile: {
        id: profiles.id,
        displayName: profiles.displayName,
        initials: profiles.initials,
        accent: profiles.accent,
      },
      updatedByProfile: {
        id: updatedByProfiles.id,
        displayName: updatedByProfiles.displayName,
        initials: updatedByProfiles.initials,
        accent: updatedByProfiles.accent,
      },
    })
    .from(knowledgeItems)
    .innerJoin(profiles, eq(profiles.id, knowledgeItems.addedBy))
    .leftJoin(updatedByProfiles, eq(updatedByProfiles.id, knowledgeItems.updatedBy))
    .where(where);

  return rows.map(({ item, profile, updatedByProfile }) =>
    mapRow(item, toUserSummary(profile), updatedByProfile ? toUserSummary(updatedByProfile) : null),
  );
}

/**
 * Non-deleted items in `groupId` whose normalized key matches one of the given
 * lists: `lower(btrim(term))` for vocabulary, `lower(btrim(title))` for grammar
 * and reading. Callers pass already-normalized (trimmed + lowercased) values.
 * Used only to warn about duplicates on add — returns just id/type/term/title.
 */
export async function findKnowledgeByNormalizedKey(
  groupId: string,
  keys: { vocabulary: string[]; grammar: string[]; reading: string[] },
): Promise<{ id: string; type: KnowledgeType; term: string | null; title: string | null }[]> {
  const typeClauses = [
    keys.vocabulary.length > 0
      ? and(
          eq(knowledgeItems.type, "vocabulary"),
          inArray(sql`lower(btrim(${knowledgeItems.term}))`, keys.vocabulary),
        )
      : null,
    keys.grammar.length > 0
      ? and(
          eq(knowledgeItems.type, "grammar"),
          inArray(sql`lower(btrim(${knowledgeItems.title}))`, keys.grammar),
        )
      : null,
    keys.reading.length > 0
      ? and(
          eq(knowledgeItems.type, "reading"),
          inArray(sql`lower(btrim(${knowledgeItems.title}))`, keys.reading),
        )
      : null,
  ].filter((c): c is NonNullable<typeof c> => c != null);

  if (typeClauses.length === 0) return [];

  const rows = await db
    .select({
      id: knowledgeItems.id,
      type: knowledgeItems.type,
      term: knowledgeItems.term,
      title: knowledgeItems.title,
    })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
        or(...typeClauses),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    type: r.type as KnowledgeType,
    term: r.term,
    title: r.title,
  }));
}

export async function insertKnowledgeItem(
  tx: Db,
  row: NewKnowledgeItemRow,
): Promise<KnowledgeItem> {
  const [inserted] = await tx.insert(knowledgeItems).values(row).returning();
  const [profile] = await tx
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      initials: profiles.initials,
      accent: profiles.accent,
    })
    .from(profiles)
    .where(eq(profiles.id, inserted.addedBy))
    .limit(1);
  return mapRow(inserted, toUserSummary(profile), null);
}

export async function updateKnowledgeItem(
  tx: Db,
  groupId: string,
  id: string,
  updatedBy: string,
  fields: Partial<NewKnowledgeItemRow>,
): Promise<KnowledgeItem | null> {
  const [updated] = await tx
    .update(knowledgeItems)
    .set({ ...fields, updatedBy, updatedAt: new Date() })
    .where(
      and(
        eq(knowledgeItems.id, id),
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .returning({ id: knowledgeItems.id });
  if (!updated) return null;
  const items = await selectWithAttribution(eq(knowledgeItems.id, updated.id), tx);
  return items[0] ?? null;
}

/** Overwrite the stored comprehension quiz for one reading. Scoped to the group
 *  and to non-deleted rows; a no-op if the id doesn't match. */
export async function setReadingQuiz(
  groupId: string,
  id: string,
  quiz: ReadingQuiz,
): Promise<void> {
  await db
    .update(knowledgeItems)
    .set({ readingQuiz: quiz })
    .where(
      and(
        eq(knowledgeItems.id, id),
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    );
}

export async function softDeleteKnowledgeItem(groupId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .update(knowledgeItems)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(knowledgeItems.id, id),
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .returning({ id: knowledgeItems.id });
  return !!deleted;
}

export async function listKnowledgeItems(
  groupId: string,
  filter: KnowledgeListFilter = {},
): Promise<KnowledgeItem[]> {
  // File type is not supported in this phase; return empty list rather than unfiltered results
  if (filter.type === "file") {
    return [];
  }
  return selectWithAttribution(buildFilter(groupId, filter));
}

export async function getKnowledgeItemById(
  groupId: string,
  id: string,
): Promise<KnowledgeItem | null> {
  if (!isUuid(id)) return null;
  const items = await selectWithAttribution(
    and(
      eq(knowledgeItems.groupId, groupId),
      eq(knowledgeItems.id, id),
      isNull(knowledgeItems.deletedAt),
    ),
  );
  return items[0] ?? null;
}

export async function getKnowledgeStats(
  groupId: string,
): Promise<{ type: KnowledgeType; count: number }[]> {
  // Using sql raw to work around Drizzle enum type inference issues
  const result = await db.execute<{ type: string; count: number }>(
    sql`SELECT type, COUNT(*)::int as count FROM public.knowledge_items WHERE group_id = ${groupId} AND deleted_at IS NULL GROUP BY type ORDER BY type`,
  );
  return result.map((r) => ({ type: r.type as KnowledgeType, count: r.count }));
}

export async function getDistinctLevels(groupId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ level: knowledgeItems.level })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.groupId, groupId),
        sql`${knowledgeItems.level} IS NOT NULL`,
        isNull(knowledgeItems.deletedAt),
      ),
    );
  return rows.map((r) => r.level!).sort();
}
