import type { GroupMemberSummary, KnowledgeItem, KnowledgeType, UserSummary } from "@/types";

import { MOCK_KNOWLEDGE } from "./knowledge";
import { MOCK_CURRENT_USER, MOCK_MEMBERS } from "./users";

/**
 * Read-only mock data access — the single surface screens import from.
 *
 * When the backend arrives, re-implement these functions as async calls into
 * `server/services` / `server/repositories`; call sites (which should already
 * treat them as `await`-able) barely change. Do not import the raw arrays
 * (`MOCK_KNOWLEDGE` etc.) from feature code.
 */

export async function getCurrentUser(): Promise<UserSummary> {
  return MOCK_CURRENT_USER;
}

export async function getGroupMembers(): Promise<GroupMemberSummary[]> {
  return MOCK_MEMBERS;
}

export interface KnowledgeQuery {
  type?: KnowledgeType;
  search?: string;
}

export async function getKnowledgeItems(query: KnowledgeQuery = {}): Promise<KnowledgeItem[]> {
  let items = [...MOCK_KNOWLEDGE];
  if (query.type) {
    items = items.filter((item) => item.type === query.type);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    items = items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getKnowledgeById(id: string): Promise<KnowledgeItem | null> {
  return MOCK_KNOWLEDGE.find((item) => item.id === id) ?? null;
}

/** Counts used for nav badges and the Today summary. */
export async function getLibraryStats(): Promise<
  Record<KnowledgeType, number> & { total: number }
> {
  const base = { vocabulary: 0, grammar: 0, reading: 0, file: 0, note: 0 };
  for (const item of MOCK_KNOWLEDGE) base[item.type] += 1;
  return { ...base, total: MOCK_KNOWLEDGE.length };
}
