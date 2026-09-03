import type {
  AiSuggestion,
  CEFRLevel,
  GrammarItem,
  GroupMemberSummary,
  KnowledgeItem,
  KnowledgeType,
  ReadingItem,
  UserSummary,
  VocabularyItem,
} from "@/types";
import { knowledgeTitle } from "@/types";
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

/** Resolve several ids at once, preserving order and dropping unknown ids. */
export async function getKnowledgeByIds(ids: string[]): Promise<KnowledgeItem[]> {
  return ids
    .map((id) => MOCK_KNOWLEDGE.find((item) => item.id === id))
    .filter((item): item is KnowledgeItem => item != null);
}

/**
 * Stand-in for the AI structuring step (`ai/services/KnowledgeProcessor`).
 * A deterministic heuristic over the pasted text — no provider call, no
 * randomness. Returns `null` when there's nothing to work with, so the UI can
 * fall back to manual entry. Replace with the real service later; the return
 * shape (`AiSuggestion`) does not change.
 */
export async function getAiSuggestion(rawText: string): Promise<AiSuggestion | null> {
  const text = rawText.trim();
  // Nothing to structure: too short, or no actual words (punctuation / symbols only).
  if (text.length < 2 || !/\p{L}/u.test(text)) return null;

  const firstLine = text.split(/\r?\n/)[0].trim();
  const words = text.split(/\s+/).filter(Boolean);

  // "term — meaning" / "term - meaning" / "term = meaning" / "term: meaning"
  const pair = firstLine.match(/^(.{1,60}?)\s*[—–\-=:]\s*(.+)$/);
  if (pair && !/[.!?]/.test(pair[1])) {
    return {
      type: "vocabulary",
      fields: { term: pair[1].trim(), meaning: pair[2].trim(), partOfSpeech: "" },
      notice: "Check the word type and level — I left those blank.",
    };
  }

  // Longer prose → a reading
  if (words.length > 25 || /[.!?].+[.!?]/.test(text)) {
    const stem = words.slice(0, 6).join(" ").replace(/[.,;:]$/, "");
    return {
      type: "reading",
      fields: {
        title: words.length > 6 ? `${stem}…` : stem,
        readingBody: text,
        summary: "",
      },
      notice: "Give it a proper title and summary before saving.",
    };
  }

  // Grammar-ish keywords
  if (
    /\b(regel|woordvolgorde|vervoeg\w*|naamval|lidwoord|inversie|conjug\w*|word order|tense)\b/i.test(
      text,
    )
  ) {
    return {
      type: "grammar",
      fields: { title: firstLine.slice(0, 60), summary: "", explanation: text },
      notice: "Add a one-line summary and examples.",
    };
  }

  // Short bare phrase → vocabulary, term only
  if (words.length <= 5) {
    return {
      type: "vocabulary",
      fields: { term: text, meaning: "", partOfSpeech: "" },
      notice: "Add the meaning and word type.",
    };
  }

  return { type: "note", fields: { title: "", noteBody: text } };
}

/** Counts used for nav badges and the Today summary. */
export async function getLibraryStats(): Promise<
  Record<KnowledgeType, number> & { total: number }
> {
  const base = { vocabulary: 0, grammar: 0, reading: 0, file: 0, note: 0 };
  for (const item of MOCK_KNOWLEDGE) base[item.type] += 1;
  return { ...base, total: MOCK_KNOWLEDGE.length };
}

// ---------------------------------------------------------------------------
// Library

export type LibrarySort = "newest" | "oldest" | "az";

export interface LibraryQuery {
  q?: string;
  /** One of the KNOWLEDGE_TYPES, or undefined for "all". */
  type?: KnowledgeType;
  level?: CEFRLevel;
  /** Group member id. */
  by?: string;
  sort?: LibrarySort;
}

export interface LibraryResult {
  items: KnowledgeItem[];
  /** Matches before pagination. */
  total: number;
  /** Total in the library, ignoring filters. */
  libraryTotal: number;
}

const PAGE_SIZE = 12;

export async function getLibraryItems(query: LibraryQuery = {}, page = 1): Promise<LibraryResult> {
  let items = [...MOCK_KNOWLEDGE];

  if (query.type) items = items.filter((i) => i.type === query.type);
  if (query.level) items = items.filter((i) => i.level === query.level);
  if (query.by) items = items.filter((i) => i.addedBy.id === query.by);
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter((i) => JSON.stringify(i).toLowerCase().includes(q));
  }

  items.sort((a, b) => {
    if (query.sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (query.sort === "az") {
      return knowledgeTitle(a).localeCompare(knowledgeTitle(b), "nl", { sensitivity: "base" });
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const total = items.length;
  return {
    items: items.slice(0, page * PAGE_SIZE),
    total,
    libraryTotal: MOCK_KNOWLEDGE.length,
  };
}

/** Facets for the Library filter dropdowns. */
export async function getLibraryFacets(): Promise<{
  levels: CEFRLevel[];
  members: GroupMemberSummary[];
}> {
  const levels = [
    ...new Set(MOCK_KNOWLEDGE.map((i) => i.level).filter((l): l is CEFRLevel => l != null)),
  ].sort();
  return { levels, members: MOCK_MEMBERS };
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
