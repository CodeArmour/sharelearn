"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { type Locale, locales } from "@/i18n/config";
import { setLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils/cn";

/**
 * NL / EN language switcher. Doubles as a learner practice aid — flip the UI to
 * the other language to test comprehension. Persists to a cookie, then refreshes
 * the server tree.
 */
export function LocaleToggle({ className }: { className?: string }) {
  const active = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === active || pending) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("switcherLabel")}
      className={cn(
        "inline-flex gap-0.5 rounded-md bg-surface-sunken p-0.5",
        pending && "opacity-60",
        className,
      )}
    >
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={isActive}
            disabled={pending}
            onClick={() => choose(locale)}
            className={cn(
              "rounded-sm px-2 py-1 text-caption font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
              isActive ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
            )}
          >
            {t(locale)}
          </button>
        );
      })}
    </div>
  );
}
