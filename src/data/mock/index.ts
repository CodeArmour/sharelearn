import type {
  GrammarItem,
  GroupMemberSummary,
  KnowledgeItem,
  KnowledgeType,
  ReadingItem,
  UserSummary,
  VocabularyItem,
} from "@/types";
import { isSameDay } from "@/lib/utils/date";

import { MOCK_KNOWLEDGE } from "./knowledge";
import { MOCK_CURRENT_USER, MOCK_MEMBERS } from "./users";

/**
 * Read-only mock data access — the single surface screens import from.
 *
 * When the backend arrives, re-implement these functions as async calls into
 * `server/services` / `server/repositories`; call sites (which already treat
 * them as `await`-able) barely change. Do not import the raw arrays
 * (`MOCK_KNOWLEDGE` etc.) from feature code.
 */

/** Fixed "now" for the mock so server-rendered dates are stable. */
const MOCK_TODAY = "2026-09-02T18:00:00.000Z";

export async function getTodayReferenceDate(): Promise<Date> {
  return new Date(MOCK_TODAY);
}

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

export interface TodayFeed {
  /** ISO timestamp of the reference day. */
  date: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  /** Readings and files, newest first. */
  textsAndFiles: KnowledgeItem[];
  practice: {
    /** Practiseable items added today (vocabulary + grammar + readings). */
    itemCount: number;
    questionCount: number;
    minutes: number;
  };
}

/** What the group added today, grouped for the Today screen. */
export async function getTodayFeed(): Promise<TodayFeed> {
  // Chronological (oldest first) — reads like a timeline of the day.
  const addedToday = MOCK_KNOWLEDGE.filter((item) => isSameDay(item.createdAt, MOCK_TODAY)).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  );

  const vocabulary = addedToday.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const grammar = addedToday.filter((i): i is GrammarItem => i.type === "grammar");
  const readings = addedToday.filter((i): i is ReadingItem => i.type === "reading");
  const textsAndFiles = addedToday.filter((i) => i.type === "reading" || i.type === "file");

  return {
    date: MOCK_TODAY,
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
