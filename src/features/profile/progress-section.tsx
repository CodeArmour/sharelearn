"use client";

import { useLocale, useTranslations } from "next-intl";

import type { KnowledgeType, StudyHistory, StudyRunSummary } from "@/types";
import { formatDateShort } from "@/lib/utils/date";
import { Section } from "@/components/layout";

const TYPES: KnowledgeType[] = ["vocabulary", "grammar", "reading", "file", "note"];

function runContext(
  run: StudyRunSummary,
  tScope: (k: StudyRunSummary["scope"]) => string,
): string {
  if (run.scope === "level" && run.level) return run.level;
  return tScope(run.scope);
}

export function ProgressSection({
  libraryStats,
  history,
}: {
  libraryStats: Record<KnowledgeType, number> & { total: number };
  history: StudyHistory;
}) {
  const t = useTranslations("profile");
  const tType = useTranslations("knowledge.type");
  const locale = useLocale();

  const headline = [
    { label: t("progress.runsCompleted"), value: history.totals.runCount },
    { label: t("progress.avgScore"), value: `${history.totals.avgScorePercent}%` },
    { label: t("progress.marked"), value: history.markedCount },
    { label: t("progress.libraryItems"), value: libraryStats.total },
  ];

  return (
    <Section title={t("progress.title")}>
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {headline.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="font-display text-h2 text-fg">{s.value}</span>
              <span className="text-caption text-fg-muted">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-label text-fg-muted">{t("progress.recentRuns")}</span>
          {history.runs.length === 0 ? (
            <p className="text-body-sm text-fg-muted">{t("progress.noRuns")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-body-sm"
                >
                  <span className="text-caption text-fg-muted">
                    {formatDateShort(run.completedAt, locale)}
                  </span>
                  <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-caption font-medium text-fg-secondary">
                    {t(`progress.runKind.${run.kind}`)}
                  </span>
                  {run.mode ? (
                    <span className="text-fg-secondary">{t(`progress.runMode.${run.mode}`)}</span>
                  ) : null}
                  <span className="text-fg-muted">
                    · {runContext(run, (k) => t(`progress.scope.${k}`))}
                  </span>
                  <span className="text-fg">
                    ·{" "}
                    {t("progress.runScore", {
                      correct: run.correctCount,
                      total: run.questionCount,
                      percent: run.scorePercent,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
