import type { Locale } from "@/i18n/config";

/** Date formatting, locale-aware. */

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "woensdag 2 september" / "Wednesday, 2 September" — Today page subtitle. */
export function formatDateLong(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(value));
}

/** e.g. "2 sep 2026" / "2 Sept 2026" — attribution / metadata. */
export function formatDateShort(value: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(toDate(value))
    .replace(".", "");
}

/** True when both timestamps fall on the same calendar day (local time). */
export function isSameDay(a: string | Date, b: string | Date): boolean {
  const da = toDate(a);
  const db = toDate(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
