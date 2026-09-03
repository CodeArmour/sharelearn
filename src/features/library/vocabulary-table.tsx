"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, ChevronRight, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import type { VocabularyItem } from "@/types";
import { useReviewMarks } from "@/lib/review-marks";
import { cn } from "@/lib/utils/cn";

type StudyMode = "show" | "hideMeaning" | "hideDutch";

const DOTS = "•".repeat(10);

/**
 * Lightweight memorization table for vocabulary. Study Mode hides a column;
 * each row's eye reveals just that row; Reset re-hides everything. Not a
 * replacement for Practice — no scoring, timing or answer evaluation.
 *
 * Each row expands to a detail panel (grammatical forms, full example, usage
 * note, tags) with a link to the full Knowledge Detail page. Expansion is
 * independent per row and orthogonal to Study Mode.
 */
export function VocabularyTable({ items }: { items: VocabularyItem[] }) {
  const t = useTranslations("library");
  const td = useTranslations("knowledge.detail");
  const [mode, setMode] = useState<StudyMode>("show");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [marked, toggleMark] = useReviewMarks();

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const changeMode = (m: StudyMode) => {
    setMode(m);
    setRevealed(new Set());
  };

  const modes: { key: StudyMode; label: string }[] = [
    { key: "show", label: t("study.show") },
    { key: "hideMeaning", label: t("study.hideMeaning") },
    { key: "hideDutch", label: t("study.hideDutch") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        <span className="text-body-sm font-medium text-fg-secondary">{t("study.label")}</span>
        <div
          role="group"
          aria-label={t("study.label")}
          className="flex w-full flex-col gap-0.5 rounded-md bg-surface-sunken p-0.5 sm:inline-flex sm:w-auto sm:flex-row"
        >
          {modes.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => changeMode(key)}
              className={cn(
                "rounded-sm px-3 py-1.5 text-left text-body-sm font-medium transition-colors sm:py-1 sm:text-center",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
                mode === key ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== "show" && (
          <button
            type="button"
            onClick={() => setRevealed(new Set())}
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-body-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("study.reset")}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="bg-knowledge-vocabulary-subtle text-label font-medium text-fg-muted">
              <Th className="w-10" />
              <Th className="w-[24%]">{t("table.nederlands")}</Th>
              <Th className="w-[22%]">{t("table.betekenis")}</Th>
              <Th className="w-[16%]">{t("table.woordsoort")}</Th>
              <Th className="w-[8%]">{t("table.niveau")}</Th>
              <Th className="w-[18%]">{t("table.voorbeeld")}</Th>
              <Th className="w-[8%] text-right">{t("table.review")}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isRevealed = revealed.has(item.id);
              const isExpanded = expanded.has(item.id);
              const forms = [
                item.article && { label: td("article"), value: item.article },
                item.plural && { label: td("plural"), value: item.plural },
                item.pastTense && { label: td("pastTense"), value: item.pastTense },
                item.perfect && { label: td("perfect"), value: item.perfect },
              ].filter((f): f is { label: string; value: string } => Boolean(f));

              return (
                <Fragment key={item.id}>
                  <tr className="border-t border-border align-middle">
                    <Td className="w-10">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`row-detail-${item.id}`}
                        aria-label={isExpanded ? t("table.collapse") : t("table.expand")}
                        onClick={() => setExpanded((s) => toggle(s, item.id))}
                        className="inline-flex size-8 items-center justify-center rounded-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
                      >
                        <ChevronRight
                          className={cn("size-4 transition-transform", isExpanded && "rotate-90")}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </button>
                    </Td>
                    <Td>
                      <RevealCell
                        value={item.term}
                        masked={mode === "hideDutch" && !isRevealed}
                        onReveal={() => setRevealed((s) => toggle(s, item.id))}
                        strong
                        showLabel={t("table.reveal")}
                        hideLabel={t("table.hide")}
                        revealed={isRevealed}
                      />
                    </Td>
                    <Td>
                      <RevealCell
                        value={item.meaning}
                        masked={mode === "hideMeaning" && !isRevealed}
                        onReveal={() => setRevealed((s) => toggle(s, item.id))}
                        showLabel={t("table.reveal")}
                        hideLabel={t("table.hide")}
                        revealed={isRevealed}
                      />
                    </Td>
                    <Td className="text-body-sm text-fg-secondary">{item.partOfSpeech}</Td>
                    <Td>
                      {item.level ? (
                        <span className="inline-flex rounded-sm bg-knowledge-vocabulary-subtle px-1.5 py-0.5 text-caption font-medium text-knowledge-vocabulary-strong">
                          {item.level}
                        </span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </Td>
                    <Td className="max-w-0 truncate text-body-sm text-fg-muted italic">
                      {item.example ?? "—"}
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        aria-pressed={marked.has(item.id)}
                        aria-label={marked.has(item.id) ? t("table.marked") : t("table.markReview")}
                        onClick={() => toggleMark(item.id)}
                        className={cn(
                          "inline-flex size-8 items-center justify-center rounded-sm transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
                          marked.has(item.id)
                            ? "text-knowledge-vocabulary"
                            : "text-fg-muted hover:text-fg",
                        )}
                      >
                        <Bookmark
                          className="size-4"
                          strokeWidth={1.75}
                          fill={marked.has(item.id) ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </button>
                    </Td>
                  </tr>

                  {isExpanded && (
                    <tr
                      id={`row-detail-${item.id}`}
                      className="border-t border-border bg-surface-subtle"
                    >
                      <td colSpan={7} className="px-4 py-4">
                        <div className="sticky left-0 flex max-w-[42rem] flex-col gap-4">
                          {forms.length > 0 && (
                            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                              {forms.map((f) => (
                                <div key={f.label} className="flex flex-col gap-0.5">
                                  <dt className="text-caption text-fg-muted">{f.label}</dt>
                                  <dd className="text-body-sm text-fg">{f.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}

                          {item.example && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-caption text-fg-muted">{td("example")}</span>
                              <p className="font-reading text-body text-fg italic">
                                {item.example}
                              </p>
                              {item.exampleTranslation && (
                                <p className="text-body-sm text-fg-muted">
                                  {item.exampleTranslation}
                                </p>
                              )}
                            </div>
                          )}

                          {item.usageNote && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-caption text-fg-muted">{td("usageNote")}</span>
                              <p className="text-body-sm text-fg-secondary">{item.usageNote}</p>
                            </div>
                          )}

                          {item.tags.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5">
                              {item.tags.map((tag) => (
                                <li
                                  key={tag}
                                  className="rounded-pill bg-surface-sunken px-2 py-0.5 text-caption text-fg-secondary"
                                >
                                  {tag}
                                </li>
                              ))}
                            </ul>
                          )}

                          <Link
                            href={`/knowledge/${item.id}`}
                            className="inline-flex w-fit items-center gap-1 text-body-sm font-medium text-link transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                          >
                            {t("table.openFull")}
                            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}

function RevealCell({
  value,
  masked,
  revealed,
  onReveal,
  strong,
  showLabel,
  hideLabel,
}: {
  value: string;
  masked: boolean;
  revealed: boolean;
  onReveal: () => void;
  strong?: boolean;
  showLabel: string;
  hideLabel: string;
}) {
  if (!masked && !revealed) {
    return (
      <span className={strong ? "text-body font-medium text-fg" : "text-body-sm text-fg-secondary"}>
        {value}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-sm",
        revealed && "-mx-1 bg-knowledge-vocabulary-subtle px-1",
      )}
    >
      {revealed ? (
        <span
          className={strong ? "text-body font-medium text-fg" : "text-body-sm text-fg-secondary"}
        >
          {value}
        </span>
      ) : (
        <span className="tracking-widest text-fg-muted select-none" aria-hidden>
          {DOTS}
        </span>
      )}
      <button
        type="button"
        onClick={onReveal}
        aria-label={revealed ? hideLabel : showLabel}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
      >
        {revealed ? (
          <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <Eye className="size-4" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </span>
  );
}
