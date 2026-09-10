import "server-only";

import { db, type Db } from "@/server/db/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import {
  findKnowledgeByNormalizedKey,
  getDistinctLevels,
  getKnowledgeItemById,
  getKnowledgeStats,
  insertKnowledgeItem,
  listKnowledgeItems,
  softDeleteKnowledgeItem,
  updateKnowledgeItem as updateKnowledgeItemRow,
} from "@/server/repositories/knowledge";
import { listMembers } from "@/server/repositories/memberships";
import { resolveActiveContext } from "@/server/services/session-service";
import type {
  AiSuggestion,
  CEFRLevel,
  GrammarItem,
  GroupMemberSummary,
  GroupRole,
  KnowledgeItem,
  KnowledgeType,
  ReadingItem,
  VocabularyItem,
} from "@/types";
import { knowledgeTitle } from "@/types";

import type { NewKnowledgeItemRow } from "@/server/db/schema";

import type { CreateKnowledgeItemInput } from "@/server/actions/schemas";

async function requireActiveGroupId(): Promise<{
  groupId: string;
  userId: string;
  role: GroupRole;
}> {
  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") throw new NotFoundError("No active group");
  return { groupId: ctx.activeGroup.id, userId: ctx.user.id, role: ctx.membership.role };
}

function assertCanModify(item: KnowledgeItem, userId: string, role: GroupRole): void {
  if (item.addedBy.id !== userId && role !== "owner") {
    throw new ForbiddenError("Only the author or the group owner can edit or delete this item");
  }
}

function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

/** Shape one validated create-input into the DB row, per type. Shared by the
 *  single-item and batch create paths so they cannot drift. */
export function buildKnowledgeRow(
  ctx: { groupId: string; userId: string },
  input: CreateKnowledgeItemInput,
): NewKnowledgeItemRow {
  const shared = {
    groupId: ctx.groupId,
    addedBy: ctx.userId,
    level: input.level,
    tags: input.tags,
    source: input.source,
  };

  switch (input.type) {
    case "vocabulary":
      return { ...shared, ...input, type: "vocabulary" };
    case "grammar":
      return { ...shared, ...input, type: "grammar" };
    case "reading":
      return {
        ...shared,
        ...input,
        type: "reading",
        wordCount: wordCount(input.body),
        vocabularyIds: [],
        readingQuiz: null,
      };
    case "note":
      return { ...shared, ...input, type: "note" };
  }
}

export async function createKnowledgeItem(input: CreateKnowledgeItemInput): Promise<KnowledgeItem> {
  const { groupId, userId } = await requireActiveGroupId();
  return db.transaction((tx) =>
    insertKnowledgeItem(tx as unknown as Db, buildKnowledgeRow({ groupId, userId }, input)),
  );
}

/**
 * Bulk-create knowledge items from the AI photo-capture review checklist. One
 * transaction, one `insertKnowledgeItem` per input, sequential so the rows
 * share the connection cleanly. Any row throwing rolls the whole batch back.
 */
export async function createKnowledgeItems(
  inputs: CreateKnowledgeItemInput[],
): Promise<KnowledgeItem[]> {
  const { groupId, userId } = await requireActiveGroupId();
  return db.transaction(async (tx) => {
    const dbtx = tx as unknown as Db;
    const created: KnowledgeItem[] = [];
    for (const input of inputs) {
      created.push(await insertKnowledgeItem(dbtx, buildKnowledgeRow({ groupId, userId }, input)));
    }
    return created;
  });
}

/** The value a new item would collide on: `term` for vocabulary, `title` for
 *  grammar and reading. Notes are never de-duplicated. */
export type DuplicateKey = { type: "vocabulary" | "grammar" | "reading"; value: string };

export function duplicateKeyFromInput(input: CreateKnowledgeItemInput): DuplicateKey | null {
  if (input.type === "vocabulary") return { type: "vocabulary", value: input.term };
  if (input.type === "grammar" || input.type === "reading")
    return { type: input.type, value: input.title };
  return null;
}

export function duplicateKeyFromSuggestion(s: AiSuggestion): DuplicateKey | null {
  if (s.type === "vocabulary") return { type: "vocabulary", value: s.fields.term ?? "" };
  if (s.type === "grammar" || s.type === "reading")
    return { type: s.type, value: s.fields.title ?? "" };
  return null;
}

const normalizeKey = (value: string): string => value.trim().toLowerCase();

/**
 * For each key (index-aligned with the caller's list), the id and display label
 * of an existing non-deleted item in the active group with the same normalized
 * key. `null` entries (notes, blank values) and non-matches are simply absent
 * from the result. Match is case-insensitive and trims surrounding whitespace.
 */
export async function findDuplicateKeys(
  keys: (DuplicateKey | null)[],
  groupIdOverride?: string,
): Promise<Map<number, { existingId: string; label: string }>> {
  const result = new Map<number, { existingId: string; label: string }>();

  const wanted = keys
    .map((key, index) => ({ index, key }))
    .filter(
      (k): k is { index: number; key: DuplicateKey } =>
        k.key != null && normalizeKey(k.key.value).length > 0,
    );
  if (wanted.length === 0) return result;

  const groupId = groupIdOverride ?? (await requireActiveGroupId()).groupId;

  const byType = { vocabulary: [] as string[], grammar: [] as string[], reading: [] as string[] };
  for (const { key } of wanted) byType[key.type].push(normalizeKey(key.value));

  const existing = await findKnowledgeByNormalizedKey(groupId, byType);

  const lookup = new Map<string, { existingId: string; label: string }>();
  for (const row of existing) {
    const label = row.type === "vocabulary" ? row.term : row.title;
    if (!label) continue;
    lookup.set(`${row.type} ${normalizeKey(label)}`, { existingId: row.id, label });
  }

  for (const { index, key } of wanted) {
    const hit = lookup.get(`${key.type} ${normalizeKey(key.value)}`);
    if (hit) result.set(index, hit);
  }
  return result;
}

export async function updateKnowledgeItem(
  id: string,
  input: CreateKnowledgeItemInput,
): Promise<KnowledgeItem> {
  const { groupId, userId, role } = await requireActiveGroupId();
  const existing = await getKnowledgeItemById(groupId, id);
  if (!existing) throw new NotFoundError("Knowledge item not found");
  assertCanModify(existing, userId, role);
  if (input.type !== existing.type) {
    throw new ValidationError("Changing a knowledge item's type is not supported");
  }

  // Provenance (how the item was originally captured) isn't something an edit
  // should be able to change — the edit form always submits "manual" since it
  // has no AI-capture UI in edit mode, so preserve the item's original source
  // rather than trusting input.source here. This must be spread AFTER `input`
  // below, since `input` also carries a `source` key that would otherwise win.
  const preserved = { source: existing.source };

  const updated = await db.transaction((tx) => {
    const dbtx = tx as unknown as Db;
    switch (input.type) {
      case "vocabulary":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, {
          ...input,
          ...preserved,
          type: "vocabulary",
        });
      case "grammar":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, {
          ...input,
          ...preserved,
          type: "grammar",
        });
      case "reading":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, {
          ...input,
          ...preserved,
          type: "reading",
          wordCount: wordCount(input.body),
        });
      case "note":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, {
          ...input,
          ...preserved,
          type: "note",
        });
    }
  });
  if (!updated) throw new NotFoundError("Knowledge item not found");
  return updated;
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  const { groupId, userId, role } = await requireActiveGroupId();
  const existing = await getKnowledgeItemById(groupId, id);
  if (!existing) throw new NotFoundError("Knowledge item not found");
  assertCanModify(existing, userId, role);
  const deleted = await softDeleteKnowledgeItem(groupId, id);
  if (!deleted) throw new NotFoundError("Knowledge item not found");
}

export interface TodayFeed {
  date: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  textsAndFiles: KnowledgeItem[];
  practice: { itemCount: number; questionCount: number; minutes: number };
}

function isSameCalendarDay(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

export async function getTodayFeed(): Promise<TodayFeed> {
  const { groupId } = await requireActiveGroupId();
  const now = new Date();
  const items = await listKnowledgeItems(groupId);
  const addedToday = items
    .filter((i) => isSameCalendarDay(i.createdAt, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const vocabulary = addedToday.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const grammar = addedToday.filter((i): i is GrammarItem => i.type === "grammar");
  const readings = addedToday.filter((i): i is ReadingItem => i.type === "reading");
  const textsAndFiles = addedToday.filter((i) => i.type === "reading" || i.type === "file");

  return {
    date: now.toISOString(),
    vocabulary,
    grammar,
    textsAndFiles,
    practice: {
      itemCount: vocabulary.length + grammar.length + readings.length,
      questionCount: 10,
      minutes: 4,
    },
  };
}

export type LibrarySort = "newest" | "oldest" | "az";

export interface LibraryQuery {
  q?: string;
  type?: KnowledgeType;
  level?: CEFRLevel;
  by?: string;
  sort?: LibrarySort;
}

export interface LibraryResult {
  items: KnowledgeItem[];
  total: number;
  libraryTotal: number;
}

const PAGE_SIZE = 12;

export async function getLibraryItems(query: LibraryQuery = {}, page = 1): Promise<LibraryResult> {
  const { groupId } = await requireActiveGroupId();
  const [items, libraryTotal] = await Promise.all([
    listKnowledgeItems(groupId, {
      type: query.type,
      level: query.level,
      addedBy: query.by,
      search: query.q,
    }),
    listKnowledgeItems(groupId).then((all) => all.length),
  ]);

  items.sort((a, b) => {
    if (query.sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (query.sort === "az") {
      return knowledgeTitle(a).localeCompare(knowledgeTitle(b), "nl", { sensitivity: "base" });
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  return { items: items.slice(0, page * PAGE_SIZE), total: items.length, libraryTotal };
}

export async function getLibraryFacets(): Promise<{
  levels: CEFRLevel[];
  members: GroupMemberSummary[];
}> {
  const { groupId } = await requireActiveGroupId();
  const [levels, members] = await Promise.all([getDistinctLevels(groupId), listMembers(groupId)]);
  return { levels: levels as CEFRLevel[], members };
}

export async function getLibraryStats(): Promise<
  Record<KnowledgeType, number> & { total: number }
> {
  const { groupId } = await requireActiveGroupId();
  const rows = await getKnowledgeStats(groupId);
  const base = { vocabulary: 0, grammar: 0, reading: 0, file: 0, note: 0 };
  for (const row of rows) base[row.type] = row.count;
  const total = Object.values(base).reduce((a, b) => a + b, 0);
  return { ...base, total };
}

export async function getKnowledgeById(id: string): Promise<KnowledgeItem | null> {
  const { groupId } = await requireActiveGroupId();
  return getKnowledgeItemById(groupId, id);
}

export async function getKnowledgeByIds(ids: string[]): Promise<KnowledgeItem[]> {
  if (ids.length === 0) return [];
  const { groupId } = await requireActiveGroupId();
  const items = await listKnowledgeItems(groupId, { ids });
  return ids
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is KnowledgeItem => i != null);
}
