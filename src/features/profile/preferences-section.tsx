"use client";

import { useTranslations } from "next-intl";

import { LocaleToggle } from "@/components/navigation/locale-toggle";
import { Section } from "@/components/layout";

/** Personal preferences. Language is the only real setting until the backend. */
export function PreferencesSection() {
  const t = useTranslations("profile.preferences");

  return (
    <Section title={t("title")}>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-body text-fg">{t("language")}</span>
        <LocaleToggle />
      </div>
    </Section>
  );
}
