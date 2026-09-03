/** Shared shapes for the manual capture form. */

import type { AiAttachmentKind } from "@/types";

/** Types a person can author by typing. */
export const AUTHABLE_TYPES = ["vocabulary", "grammar", "reading", "note"] as const;
export type AuthableType = (typeof AUTHABLE_TYPES)[number];

/** Everything the type picker shows — `file` selects a placeholder, not a form. */
export const PICKER_TYPES = [...AUTHABLE_TYPES, "file"] as const;
export type PickerType = (typeof PICKER_TYPES)[number];

export type Values = Record<string, string>;
export type Errors = Record<string, string>;
export type Example = { id: string; nl: string; en: string };

/**
 * A file handed to the AI capture step. Metadata only — the contents are never
 * read in the mock phase; `name` + `kind` seed the simulated suggestion.
 */
export interface AiAttachment {
  name: string;
  kind: AiAttachmentKind;
  /** Bytes, from `File.size` — shown on the chip. */
  size: number;
}

/** Classify a picked `File` by MIME type, then extension. `null` = unsupported. */
export function classifyAttachment(file: File): AiAttachment | null {
  const name = file.name;
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  let kind: AiAttachmentKind | null = null;
  if (
    file.type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext)
  ) {
    kind = "image";
  } else if (file.type === "application/pdf" || ext === "pdf") {
    kind = "pdf";
  } else if (file.type.startsWith("text/") || ["txt", "md", "markdown"].includes(ext)) {
    kind = "document";
  }
  return kind ? { name, kind, size: file.size } : null;
}

export interface FieldsProps {
  values: Values;
  errors: Errors;
  set: (name: string, value: string) => void;
}

/** Required field names per type — drives both the `*` marker and validation. */
export const REQUIRED: Record<AuthableType, string[]> = {
  vocabulary: ["term", "meaning", "partOfSpeech"],
  grammar: ["title", "summary", "explanation"],
  reading: ["title", "readingBody"],
  note: ["noteBody"],
};

/** Field name → `add.*` message key, for the "{field} is required" message. */
export const LABEL_KEY: Record<string, string> = {
  term: "field.term",
  meaning: "field.meaning",
  partOfSpeech: "field.partOfSpeech",
  title: "field.title",
  summary: "field.summary",
  explanation: "field.explanation",
  readingBody: "field.readingBody",
  noteBody: "field.noteBody",
};
