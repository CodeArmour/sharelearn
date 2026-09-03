"use client";

import { useTranslations } from "next-intl";

import type { KnowledgeType } from "@/types";
import { useReviewMarks } from "@/lib/review-marks";
import { Section } from "@/components/layout";

const TYPES: KnowledgeType[] = ["vocabulary", "grammar", "reading", "file", "note"];

/**
 * No practice/exam history is stored yet, so this is honest: a placeholder plus
 * the numbers that are real — how many items you've marked, and library totals.
 */
export function ProgressSection({
  libraryStats,
}: {
  libraryStats: Record<KnowledgeType, number> & { total: number };
}) {
  const t = useTranslations("profile.progress");
  const tType = useTranslations("knowledge.type");
  const [marks] = useReviewMarks();

  const headline = [
    { label: t("marked"), value: marks.size },
    { label: t("libraryItems"), value: libraryStats.total },
  ];

  return (
    <Section title={t("title")}>
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <p className="text-body-sm text-fg-muted">{t("placeholder")}</p>

        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {headline.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="font-display text-h2 text-fg">{s.value}</span>
              <span className="text-caption text-fg-muted">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-body-sm text-fg-secondary">
          {TYPES.filter((ty) => libraryStats[ty] > 0).map((ty) => (
            <span key={ty}>
              {tType(ty)}: <span className="font-medium text-fg">{libraryStats[ty]}</span>
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}
