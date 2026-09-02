import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Build a `generateMetadata` that sets a localized page title (fed through the
 * root layout's title template).
 *
 *   export const generateMetadata = titleMetadata((t) => t("nav.today"));
 *
 * `t` here accepts any dotted message key (`getTranslations()` resolves them at
 * runtime); key validity is enforced where the messages are authored.
 */
export function titleMetadata(resolve: (t: (key: string) => string) => string) {
  return async function generateMetadata(): Promise<Metadata> {
    const translate = await getTranslations();
    const t = (key: string) => translate(key as Parameters<typeof translate>[0]);
    return { title: resolve(t) };
  };
}
