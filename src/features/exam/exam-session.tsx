"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { examDurationMs } from "@/lib/exam-rules";
import { useCountdown } from "@/lib/use-countdown";
import { useFocusOnChange } from "@/lib/use-focus-on-change";
import { Button } from "@/components/ui";
import { OptionButton, type OptionState, PassagePanel } from "@/components/shared";
import { cn } from "@/lib/utils/cn";

import { ExamNavigator } from "./exam-navigator";
import { ExamTimer } from "./exam-timer";

const AUTOSUBMIT_MS = 10_000;

/**
 * The exam paper: one question per page, a countdown, a question navigator, and
 * per-question flags. No feedback. Handing in — or the timer reaching zero —
 * ends the run exactly once.
 */
export function ExamSession({
  questions,
  onSubmit,
  startedAtMs,
  length,
}: {
  questions: PracticeQuestion[];
  onSubmit: (answers: (number | null)[]) => void;
  startedAtMs: number;
  length: number;
}) {
  const t = useTranslations("exam.session");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [pinned, setPinned] = useState<boolean[]>(() => questions.map(() => false));
  const [confirming, setConfirming] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const submittedRef = useRef(false);

  const { remainingMs, expired } = useCountdown(startedAtMs, examDurationMs(length));

  const regionRef = useRef<HTMLDivElement>(null);
  useFocusOnChange(regionRef, index);

  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answers);
  };

  useEffect(() => {
    if (!expired || submittedRef.current) return;
    const id = setTimeout(submit, AUTOSUBMIT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const q = questions[index];
  const answeredCount = answers.filter((a) => a !== null).length;
  const flaggedCount = pinned.filter(Boolean).length;

  const pick = (opt: number) => setAnswers((prev) => prev.map((a, i) => (i === index ? opt : a)));
  const togglePin = () => setPinned((prev) => prev.map((p, i) => (i === index ? !p : p)));

  const handIn = () => {
    if (answeredCount < questions.length || flaggedCount > 0) setConfirming(true);
    else submit();
  };

  const navigator = (
    <ExamNavigator
      count={questions.length}
      current={index}
      answered={answers.map((a) => a !== null)}
      pinned={pinned}
      onJump={(i) => {
        setConfirming(false);
        setNavOpen(false);
        setIndex(i);
      }}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-[42rem]">
        <div className="flex items-center justify-between">
          <span className="text-label text-fg-muted">
            {t("questionNumber", { number: index + 1 })} / {questions.length}
          </span>
          <ExamTimer remainingMs={remainingMs} />
        </div>

        <button
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-body-sm text-fg-secondary lg:hidden"
        >
          {t("navigatorTitle")}
          <span className="text-fg-muted">
            {t("answered", { answered: answeredCount, total: questions.length })}
          </span>
        </button>
        {navOpen ? <div className="lg:hidden">{navigator}</div> : null}

        <div ref={regionRef} tabIndex={-1} className="flex flex-col gap-4 outline-none">
          {expired ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-border p-8 text-center">
              <p className="font-display text-h3 text-fg">{t("timeUp.title")}</p>
              <p className="text-body-sm text-fg-secondary">{t("timeUp.body")}</p>
              <Button type="button" size="md" onClick={submit}>
                {t("timeUp.viewResults")}
              </Button>
            </div>
          ) : confirming ? (
            <div className="flex flex-col gap-3 rounded-card border border-border p-6">
              <p className="font-display text-h3 text-fg">{t("handInConfirm.title")}</p>
              <p className="text-body-sm text-fg-secondary">
                {t("handInConfirm.body", {
                  unanswered: questions.length - answeredCount,
                  flagged: flaggedCount,
                })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" size="md" onClick={submit}>
                  {t("handInConfirm.confirm")}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                >
                  {t("handInConfirm.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {q.passage ? <PassagePanel passage={q.passage} /> : null}
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-h3 text-fg">{q.prompt}</p>
                <button
                  type="button"
                  aria-pressed={pinned[index]}
                  onClick={togglePin}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-body-sm transition-colors",
                    pinned[index]
                      ? "border-warning-strong text-warning-strong"
                      : "border-border text-fg-muted hover:text-fg",
                  )}
                >
                  <Flag className="size-4" aria-hidden />
                  {pinned[index] ? t("unpin") : t("pin")}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <OptionButton
                    key={opt}
                    label={opt}
                    state={(answers[index] === oi ? "selected" : "idle") as OptionState}
                    onClick={() => pick(oi)}
                  />
                ))}
              </div>
              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ArrowLeft className="size-[18px]" strokeWidth={2} aria-hidden />
                  {t("prev")}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  disabled={index === questions.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  {t("next")}
                  <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="hidden lg:block lg:w-56 lg:shrink-0">
        {navigator}
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-body-sm text-fg-muted">
            {t("answered", { answered: answeredCount, total: questions.length })}
          </span>
          <Button type="button" size="md" onClick={handIn} disabled={expired}>
            {t("handIn")}
          </Button>
        </div>
      </aside>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 flex items-center gap-3 border-t border-border bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <Button type="button" size="md" onClick={handIn} disabled={expired}>
          {t("handIn")}
        </Button>
        <span className="text-body-sm text-fg-muted">
          {t("answered", { answered: answeredCount, total: questions.length })}
        </span>
      </div>
    </div>
  );
}
