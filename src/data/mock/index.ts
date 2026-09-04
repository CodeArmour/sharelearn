import type { AiAttachmentKind, AiSuggestion } from "@/types";

/**
 * Read-only mock data access — the single surface screens import from for the
 * parts still simulated. Shared library data, Today, Library, and
 * practice/exam generation moved to `server/services/` in Backend Phase 2;
 * these two stay mocked until the AI phase implements the real structuring
 * step.
 */

export async function getAiSuggestion(rawText: string): Promise<AiSuggestion | null> {
  const text = rawText.trim();
  if (text.length < 2 || !/\p{L}/u.test(text)) return null;

  const firstLine = text.split(/\r?\n/)[0].trim();
  const words = text.split(/\s+/).filter(Boolean);

  const pair = firstLine.match(/^(.{1,60}?)\s*[—–\-=:]\s*(.+)$/);
  if (pair && !/[.!?]/.test(pair[1])) {
    return {
      type: "vocabulary",
      fields: { term: pair[1].trim(), meaning: pair[2].trim(), partOfSpeech: "" },
      noticeKey: "checkTypeAndLevel",
    };
  }

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

  if (words.length <= 5) {
    return {
      type: "vocabulary",
      fields: { term: text, meaning: "", partOfSpeech: "" },
      noticeKey: "meaningAndType",
    };
  }

  return { type: "note", fields: { title: "", noteBody: text } };
}

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
