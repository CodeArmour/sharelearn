import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { Button, buttonVariants } from "@/components/ui";
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
  const t = useTranslations("practice");
  const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length;
  const percent = Math.round((correctCount / questions.length) * 100);

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-6">
      <div className="flex flex-col items-center gap-1.5 rounded-card border border-border bg-surface p-8 text-center">
        <span className="font-display text-display text-fg">{t("results.percent", { percent })}</span>
        <span className="text-body text-fg-secondary">
          {t("results.score", { correct: correctCount, total: questions.length })}
        </span>
        <span className="text-caption text-fg-muted">{t("results.notSaved")}</span>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-h3 text-fg">{t("results.reviewTitle")}</h2>
        <ul className="flex flex-col gap-2.5">
          {questions.map((q, i) => {
            const answer = answers[i];
            const ok = answer === q.correctIndex;
            return (
              <li
                key={q.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill text-on-primary",
                      ok ? "bg-success" : "bg-error",
                    )}
                  >
                    {ok ? (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    ) : (
                      <X className="size-3.5" strokeWidth={3} aria-hidden />
                    )}
                  </span>
                  <p className="font-medium text-fg">{q.prompt}</p>
                </div>

                {!ok ? (
                  <div className="flex flex-col gap-0.5 pl-7 text-body-sm">
                    <p className="text-fg-muted">
                      {t("results.yourAnswer")}:{" "}
                      <span className="text-error-strong">
                        {answer === null ? t("results.noAnswer") : q.options[answer]}
                      </span>
                    </p>
                    <p className="text-fg-muted">
                      {t("results.correctAnswer")}:{" "}
                      <span className="text-success-strong">{q.options[q.correctIndex]}</span>
                    </p>
                  </div>
                ) : null}

                <Link
                  href={`/knowledge/${q.knowledgeId}`}
                  className="inline-flex w-fit items-center gap-1 pl-7 text-body-sm font-medium text-link transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                >
                  {t("feedback.viewKnowledge")}
                  <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="md" onClick={onAgain}>
          {t("results.again")}
        </Button>
        <Link href="/today" className={buttonVariants({ variant: "outline", size: "md" })}>
          {t("results.toToday")}
        </Link>
      </div>
    </div>
  );
}
