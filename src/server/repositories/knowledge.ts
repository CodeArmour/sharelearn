import "server-only";

import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db, type Db } from "@/server/db/client";
import {
  knowledgeItems,
  profiles,
  type KnowledgeItemRow,
  type NewKnowledgeItemRow,
} from "@/server/db/schema";
import type { CEFRLevel, KnowledgeItem, KnowledgeType, UserSummary } from "@/types";

export interface KnowledgeListFilter {
  type?: KnowledgeType;
  level?: string;
  addedBy?: string;
  search?: string;
  ids?: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres `uuid` columns reject non-uuid strings with a hard `22P02` error —
 * narrow id-shaped input before it ever reaches a query. */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
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
