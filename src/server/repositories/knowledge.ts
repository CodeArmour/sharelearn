import "server-only";

import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";

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

const SEARCH_COLUMNS = [
  knowledgeItems.term,
  knowledgeItems.meaning,
  knowledgeItems.title,
  knowledgeItems.summary,
  knowledgeItems.explanation,
  knowledgeItems.body,
] as const;

/** Row + joined attribution → the frontend's `KnowledgeItem` discriminated union. */
function mapRow(row: KnowledgeItemRow, addedBy: UserSummary): KnowledgeItem {
  const base = {
    id: row.id,
    level: row.level as CEFRLevel | null,
    tags: row.tags,
    source: row.source,
    addedBy,
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
  const clauses = [eq(knowledgeItems.groupId, groupId)];
  if (filter.type && filter.type !== "file") {
    clauses.push(eq(knowledgeItems.type, filter.type));
  }
  if (filter.level) clauses.push(eq(knowledgeItems.level, filter.level));
  if (filter.addedBy) clauses.push(eq(knowledgeItems.addedBy, filter.addedBy));
  if (filter.ids) clauses.push(inArray(knowledgeItems.id, filter.ids));
  if (filter.search) {
    const pattern = `%${filter.search}%`;
    clauses.push(or(...SEARCH_COLUMNS.map((col) => ilike(col, pattern)))!);
  }
  return and(...clauses);
}

async function selectWithAttribution(where: ReturnType<typeof and>): Promise<KnowledgeItem[]> {
  const rows = await db
    .select({
      item: knowledgeItems,
      profile: {
        id: profiles.id,
        displayName: profiles.displayName,
        initials: profiles.initials,
        accent: profiles.accent,
      },
    })
    .from(knowledgeItems)
    .innerJoin(profiles, eq(profiles.id, knowledgeItems.addedBy))
    .where(where);

  return rows.map(({ item, profile }) => mapRow(item, toUserSummary(profile)));
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
  return mapRow(inserted, toUserSummary(profile));
}

export async function listKnowledgeItems(
  groupId: string,
  filter: KnowledgeListFilter = {},
): Promise<KnowledgeItem[]> {
  return selectWithAttribution(buildFilter(groupId, filter));
}

export async function getKnowledgeItemById(
  groupId: string,
  id: string,
): Promise<KnowledgeItem | null> {
  const items = await selectWithAttribution(
    and(eq(knowledgeItems.groupId, groupId), eq(knowledgeItems.id, id)),
  );
  return items[0] ?? null;
}

export async function getKnowledgeStats(
  groupId: string,
): Promise<{ type: KnowledgeType; count: number }[]> {
  // Using sql raw to work around Drizzle enum type inference issues
  const result = await db.execute<{ type: string; count: number }>(
    sql`SELECT type, COUNT(*)::int as count FROM public.knowledge_items WHERE group_id = ${groupId} GROUP BY type ORDER BY type`,
  );
  return result.map((r) => ({ type: r.type as KnowledgeType, count: r.count }));
}

export async function getDistinctLevels(groupId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ level: knowledgeItems.level })
    .from(knowledgeItems)
    .where(and(eq(knowledgeItems.groupId, groupId), sql`${knowledgeItems.level} IS NOT NULL`));
  return rows.map((r) => r.level!).sort();
}
