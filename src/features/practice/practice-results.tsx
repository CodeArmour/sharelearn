import Link from "next/link";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { Button, buttonVariants } from "@/components/ui";
import { MODE_ACCENT, QuestionReviewList } from "@/components/shared";
import { cn } from "@/lib/utils/cn";

export function PracticeResults({
  questions,
  answers,
  onAgain,
}: {
  questions: PracticeQuestion[];
  answers: (number | null)[];
  onAgain: () => void;
}) {
  const t = useTranslations("practice.results");
  const accent = MODE_ACCENT.practice;
  const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length;
  const percent = Math.round((correctCount / questions.length) * 100);

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-6">
      <div
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-card border p-8 text-center",
          accent.card,
        )}
      >
        <span className={cn("font-display text-display", accent.text)}>
          {t("percent", { percent })}
        </span>
        <span className="text-body text-fg-secondary">
          {t("score", { correct: correctCount, total: questions.length })}
        </span>
        <span className="text-caption text-fg-muted">{t("notSaved")}</span>
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
