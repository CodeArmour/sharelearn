import type { CEFRLevel } from "./cefr";
import type { UserSummary } from "./user";

/**
 * Frontend rendering contracts for shared knowledge.
 *
 * These are deliberately close to the likely API / database models so that
 * swapping mock data for real server data later is a narrow change: replace the
 * `data/mock` loaders with repository/service calls that return these shapes.
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
      return item.title ?? "Notitie";
    default:
      return item.title;
  }
}
