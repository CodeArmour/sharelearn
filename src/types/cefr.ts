/** Common European Framework of Reference levels used for tagging knowledge. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CEFRLevel = (typeof CEFR_LEVELS)[number];

export function isCEFRLevel(value: unknown): value is CEFRLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);
}
