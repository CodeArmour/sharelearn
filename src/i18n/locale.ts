"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, type Locale } from "./config";

/**
 * Server Action: persist the chosen locale. The caller is responsible for
 * refreshing the router afterwards so Server Components re-render.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
