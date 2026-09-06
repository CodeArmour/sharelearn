import Link from "next/link";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { Button, buttonVariants } from "@/components/ui";
import { MODE_ACCENT, QuestionReviewList } from "@/components/shared";
import type { SaveState } from "@/lib/study-run";
import { cn } from "@/lib/utils/cn";

const PASS_THRESHOLD = 55;

export function ExamResults({
  questions,
  answers,
  onAgain,
  saveState,
  onRetrySave,
}: {
  questions: PracticeQuestion[];
  answers: (number | null)[];
  onAgain: () => void;
  saveState: SaveState | null;
  onRetrySave: () => void;
}) {
  const t = useTranslations("exam.results");
  const accent = MODE_ACCENT.exam;
  const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length;
  const percent = Math.round((correctCount / questions.length) * 100);
  const passed = percent >= PASS_THRESHOLD;

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-6">
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-card border p-8 text-center",
          accent.card,
        )}
      >
        <span className={cn("font-display text-display", accent.text)}>
          {t("percent", { percent })}
        </span>
        <span className="text-body text-fg-secondary">
          {t("score", { correct: correctCount, total: questions.length })}
        </span>
        <span
          className={cn(
            "rounded-pill px-3 py-1 text-label font-medium",
            passed ? "bg-success-subtle text-success-strong" : "bg-error-subtle text-error-strong",
          )}
        >
          {passed ? t("passed") : t("notPassed")}
        </span>
        {saveState === "saving" ? (
          <span className="text-caption text-fg-muted">{t("saving")}</span>
        ) : null}
        {saveState === "saved" ? (
          <span className="text-caption text-fg-muted">{t("saved")}</span>
        ) : null}
        {saveState === "error" ? (
          <span className="flex items-center gap-2 text-caption text-danger">
            {t("saveError")}
            <button
              type="button"
              onClick={onRetrySave}
              className="underline underline-offset-2 hover:no-underline"
            >
              {t("retry")}
            </button>
          </span>
        ) : null}
      </div>

      <QuestionReviewList questions={questions} answers={answers} />

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="md" onClick={onAgain}>
          {t("again")}
        </Button>
        <Link href="/today" className={buttonVariants({ variant: "outline", size: "md" })}>
          {t("toToday")}
        </Link>
      </div>
    </div>
  );
}
