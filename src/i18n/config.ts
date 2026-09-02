/** Locale configuration shared by the request pipeline and the UI. */

export const locales = ["nl", "en"] as const;

export type Locale = (typeof locales)[number];

/** Dutch-first product; English is the alternate / practice view. */
export const defaultLocale: Locale = "nl";

/** Cookie that carries the chosen locale (next-intl's conventional name). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
