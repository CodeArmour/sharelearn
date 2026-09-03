import type {
  AiAttachmentKind,
  AiSuggestion,
  CEFRLevel,
  GrammarItem,
  GroupMemberSummary,
  KnowledgeItem,
  KnowledgeType,
  PracticeQuestion,
  PracticeSetup,
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
      noticeKey: "checkTypeAndLevel",
    };
  }

  // Longer prose → a reading
  if (words.length > 25 || /[.!?].+[.!?]/.test(text)) {
    const stem = words
      .slice(0, 6)
      .join(" ")
      .replace(/[.,;:]$/, "");
    return {
      type: "reading",
      fields: {
        title: words.length > 6 ? `${stem}…` : stem,
        readingBody: text,
        summary: "",
      },
      noticeKey: "titleAndSummary",
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
      noticeKey: "summaryAndExamples",
    };
  }

  // Short bare phrase → vocabulary, term only
  if (words.length <= 5) {
    return {
      type: "vocabulary",
      fields: { term: text, meaning: "", partOfSpeech: "" },
      noticeKey: "meaningAndType",
    };
  }

  return { type: "note", fields: { title: "", noteBody: text } };
}

/**
 * Stand-in for the AI structuring step when the input is a picked file rather
 * than pasted text. The file's *contents* are never read here — the `kind` and
 * `name` alone seed a deterministic pre-fill, and the reviewer completes it.
 * Replace with the real service later; the return shape (`AiSuggestion`) holds.
 */
export async function getAiSuggestionFromAttachment(attachment: {
  name: string;
  kind: AiAttachmentKind;
}): Promise<AiSuggestion> {
  const base = attachment.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (attachment.kind === "image") {
    return {
      type: "vocabulary",
      fields: { term: base, meaning: "", partOfSpeech: "" },
      noticeKey: "fromPhoto",
    };
  }
  if (attachment.kind === "pdf") {
    return {
      type: "reading",
      fields: { title: base, readingBody: "", summary: "" },
      noticeKey: "fromPdf",
    };
  }
  return {
    type: "note",
    fields: { title: base, noteBody: "" },
    noticeKey: "fromDocument",
  };
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

// ---------------------------------------------------------------------------
// Practice

/** Stable string hash — for deterministic option order and question shuffling. */
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildOptions(correct: string, pool: string[], seed: string) {
  const distractors = [...new Set(pool)]
    .filter((v) => v && v !== correct)
    .sort((a, b) => a.localeCompare(b, "nl"))
    .slice(0, 3);
  const all = [correct, ...distractors];
  const rot = hashString(seed) % all.length;
  const options = [...all.slice(rot), ...all.slice(0, rot)];
  return { options, correctIndex: options.indexOf(correct) };
}

/**
 * Generate a multiple-choice practice run from the shared library. Pure and
 * deterministic (no provider call, no randomness) — safe to run client-side.
 * Replace with `ai/services/PracticeGenerator` later; the return shape holds.
 */
export async function getPracticeQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]> {
  const inScope = MOCK_KNOWLEDGE.filter((item) => {
    if (setup.scope === "today") return isSameDay(item.createdAt, MOCK_TODAY);
    if (setup.scope === "level") return item.level === setup.level;
    if (setup.scope === "review") return (setup.reviewIds ?? []).includes(item.id);
    if (setup.scope === "custom") {
      const f = setup.filter ?? {};
      if (f.type && item.type !== f.type) return false;
      if (f.level && item.level !== f.level) return false;
      if (f.by && item.addedBy.id !== f.by) return false;
      if (f.q && !JSON.stringify(item).toLowerCase().includes(f.q.toLowerCase())) return false;
      return true;
    }
    return true;
  });

  const vocabPool = MOCK_KNOWLEDGE.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const grammarPool = MOCK_KNOWLEDGE.filter((i): i is GrammarItem => i.type === "grammar");
  const allMeanings = vocabPool.map((v) => v.meaning);
  const allTerms = vocabPool.map((v) => v.term);
  const allTitles = grammarPool.map((g) => g.title);

  const wantVocab = setup.mode === "vocabulary" || setup.mode === "mixed";
  const wantGrammar = setup.mode === "grammar" || setup.mode === "mixed";
  const questions: PracticeQuestion[] = [];

  if (wantVocab) {
    inScope
      .filter((i): i is VocabularyItem => i.type === "vocabulary")
      .forEach((v, idx) => {
        if (idx % 2 === 1) {
          const { options, correctIndex } = buildOptions(v.term, allTerms, `t:${v.id}`);
          if (options.length >= 2) {
            questions.push({
              id: `q_${v.id}_t`,
              knowledgeId: v.id,
              knowledgeType: "vocabulary",
              instructionKey: "sayInDutch",
              prompt: v.meaning,
              options,
              correctIndex,
            });
          }
        } else {
          const { options, correctIndex } = buildOptions(v.meaning, allMeanings, `m:${v.id}`);
          if (options.length >= 2) {
            questions.push({
              id: `q_${v.id}_m`,
              knowledgeId: v.id,
              knowledgeType: "vocabulary",
              instructionKey: "meaningOf",
              prompt: v.term,
              options,
              correctIndex,
            });
          }
        }
      });
  }

  if (wantGrammar) {
    inScope
      .filter((i): i is GrammarItem => i.type === "grammar")
      .forEach((g) => {
        const { options, correctIndex } = buildOptions(g.title, allTitles, `g:${g.id}`);
        if (options.length >= 2) {
          questions.push({
            id: `q_${g.id}`,
            knowledgeId: g.id,
            knowledgeType: "grammar",
            instructionKey: "whichRule",
            prompt: g.examples[0]?.nl ?? g.summary,
            options,
            correctIndex,
          });
        }
      });
  }

  questions.sort((a, b) => hashString(a.id) - hashString(b.id));
  return setup.length > 0 ? questions.slice(0, setup.length) : questions;
}

/** Exams draw from the same generated multiple-choice pool as practice. */
export async function getExamQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]> {
  return getPracticeQuestions(setup);
}
