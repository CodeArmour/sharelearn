import type { CEFRLevel } from "./cefr";
import type { UserSummary } from "./user";

/**
 * Frontend rendering contracts for shared knowledge.
 *
 * These stay close to the database models: the `server/repositories` and
 * `server/services` layers return exactly these shapes, so the frontend does
 * not change when data moves.
 *
 * All knowledge is SHARED (group library). Personal state (review marks,
 * practice history) lives in `types/personal.ts`.
 */

export const KNOWLEDGE_TYPES = ["vocabulary", "grammar", "reading", "file", "note"] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

/** How an item entered the library — drives the "added via" affordance. */
export type KnowledgeSource = "manual" | "photo" | "file-upload" | "ai-assisted";

interface KnowledgeItemBase {
  id: string;
  type: KnowledgeType;
  /** CEFR level, when known. */
  level: CEFRLevel | null;
  tags: string[];
  source: KnowledgeSource;
  /** Person who added it — shared library shows attribution. */
  addedBy: UserSummary;
  /** Person who last edited it, or null if never edited. */
  updatedBy: UserSummary | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type DutchArticle = "de" | "het";

export interface VocabularyItem extends KnowledgeItemBase {
  type: "vocabulary";
  /** Dutch term / expression — the strongest element in every view. */
  term: string;
  /** Primary translation / gloss. */
  meaning: string;
  /** e.g. "Werkwoord", "Zelfstandig naamwoord", "Uitdrukking". */
  partOfSpeech: string;
  example: string | null;
  exampleTranslation: string | null;
  /** Grammatical extras surfaced in the expandable table row. */
  article: DutchArticle | null;
  plural: string | null;
  pastTense: string | null;
  perfect: string | null;
  usageNote: string | null;
}

export interface GrammarExample {
  nl: string;
  en: string | null;
}

export interface GrammarItem extends KnowledgeItemBase {
  type: "grammar";
  title: string;
  /** One-line summary shown on cards. */
  summary: string;
  /** Longer explanation (plain text / lightweight markdown). */
  explanation: string;
  examples: GrammarExample[];
}

export interface ReadingItem extends KnowledgeItemBase {
  type: "reading";
  title: string;
  /** Long-form Dutch text, rendered with the reading type style. */
  body: string;
  wordCount: number;
  summary: string | null;
  /** Vocabulary term ids highlighted within this text. */
  vocabularyIds: string[];
}

export interface FileItem extends KnowledgeItemBase {
  type: "file";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Null until a storage backend exists. */
  url: string | null;
  note: string | null;
  /** How many knowledge items were extracted from this file, if processed. */
  extractedCount: number | null;
}

export interface NoteItem extends KnowledgeItemBase {
  type: "note";
  title: string | null;
  body: string;
}

export type KnowledgeItem = VocabularyItem | GrammarItem | ReadingItem | FileItem | NoteItem;

/** The label to render as an item's heading, regardless of its type. */
export function knowledgeTitle(item: KnowledgeItem): string {
  switch (item.type) {
    case "vocabulary":
      return item.term;
    case "file":
      return item.fileName;
    case "note":
      return item.title ?? "";
    default:
      return item.title;
  }
}

/**
 * One-line supporting text shown under the title on cards. Content fields
 * (meaning, part of speech, summaries) stay in their source language; `opts`
 * carries the few UI words that need translating.
 */
export function knowledgeSnippet(item: KnowledgeItem, opts: { words: string }): string {
  switch (item.type) {
    case "vocabulary": {
      const kind = item.partOfSpeech.toLowerCase();
      return item.level ? `${item.meaning} · ${kind}, ${item.level}` : `${item.meaning} · ${kind}`;
    }
    case "grammar":
      return item.summary;
    case "reading":
      return [item.level, `${item.wordCount} ${opts.words}`, item.summary]
        .filter(Boolean)
        .join(" · ");
    case "file": {
      const ext = item.fileName.split(".").pop()?.toUpperCase() ?? "";
      return item.note ? `${ext} · ${item.note}` : ext;
    }
    case "note":
      return item.body;
  }
}
