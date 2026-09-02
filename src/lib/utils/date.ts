/**
 * Dutch date formatting. All formatters take an ISO string or Date and render
 * with the `nl-NL` locale.
 */

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "woensdag 2 september" — used for the Today page subtitle. */
export function formatDutchDateLong(value: string | Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(value));
}

/** e.g. "2 sep 2026" — used for attribution / metadata. */
export function formatDutchDateShort(value: string | Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
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
