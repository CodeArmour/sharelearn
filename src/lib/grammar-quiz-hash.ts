import type { GrammarExample } from "@/types";

/**
 * Stable, non-cryptographic hash of a grammar rule's question-relevant
 * content. Used only to decide whether a stored quiz was generated from the
 * current content, so cosmetic edits (re-wrapping, trailing spaces,
 * capitalisation) must not change it: whitespace runs collapse to one space
 * and the text is lowercased first. Same cyrb53-style algorithm as
 * `readingBodyHash`, emitted as 16 hex chars.
 *
 * `title` is included (unlike `readingBodyHash`, which hashes only the
 * passage body) because the grammar prompt uses the title as real model
 * input, not just a label — a title-only edit changes what gets generated.
 */
export function grammarSourceHash(rule: {
  title: string;
  summary: string;
  explanation: string;
  examples: GrammarExample[];
}): string {
  const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

  const parts = [
    normalize(rule.title),
    normalize(rule.summary),
    normalize(rule.explanation),
    ...rule.examples.map((ex) => normalize(`${ex.nl} :: ${ex.en ?? ""}`)),
  ];
  // JSON.stringify (not a plain join) so the array boundary itself can never
  // be confused with content — no separator string to collide with.
  const normalized = JSON.stringify(parts);

  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}
