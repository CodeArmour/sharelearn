"use client";

import { useState } from "react";
import { Bookmark, Eye, EyeOff, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import type { VocabularyItem } from "@/types";
import { cn } from "@/lib/utils/cn";

type StudyMode = "show" | "hideMeaning" | "hideDutch";

const DOTS = "•".repeat(10);

/**
 * Lightweight memorization table for vocabulary. Study Mode hides a column;
 * each row's eye reveals just that row; Reset re-hides everything. Not a
 * replacement for Practice — no scoring, timing or answer evaluation.
 *
 * Deferred (follow-up): expandable rows with full linguistic detail.
 */
export function VocabularyTable({ items }: { items: VocabularyItem[] }) {
  const t = useTranslations("library");
  const [mode, setMode] = useState<StudyMode>("show");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [marked, setMarked] = useState<Set<string>>(new Set());

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-body-sm font-medium text-fg-secondary">{t("study.label")}</span>
        <div
          role="group"
          aria-label={t("study.label")}
          className="inline-flex gap-0.5 rounded-md bg-surface-sunken p-0.5"
        >
          {modes.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => changeMode(key)}
              className={cn(
                "rounded-sm px-3 py-1 text-body-sm font-medium transition-colors",
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
              <Th className="w-[26%]">{t("table.nederlands")}</Th>
              <Th className="w-[24%]">{t("table.betekenis")}</Th>
              <Th className="w-[16%]">{t("table.woordsoort")}</Th>
              <Th className="w-[8%]">{t("table.niveau")}</Th>
              <Th className="w-[18%]">{t("table.voorbeeld")}</Th>
              <Th className="w-[8%] text-right">{t("table.review")}</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isRevealed = revealed.has(item.id);
              return (
                <tr key={item.id} className="border-t border-border align-middle">
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
                      onClick={() => setMarked((s) => toggle(s, item.id))}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
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
