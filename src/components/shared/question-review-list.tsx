import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { cn } from "@/lib/utils/cn";

/**
 * Per-question breakdown shown on the Practice and Exam results screens:
 * each question with a ✓/✗ mark, the chosen vs. correct answer when wrong,
 * and a link back to the knowledge it tested.
 */
export function QuestionReviewList({
  questions,
  answers,
}: {
  questions: PracticeQuestion[];
  answers: (number | null)[];
}) {
  const t = useTranslations("review");

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-h3 text-fg">{t("title")}</h2>
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
                    {t("yourAnswer")}:{" "}
                    <span className="text-error-strong">
                      {answer === null ? t("noAnswer") : q.options[answer]}
                    </span>
                  </p>
                  <p className="text-fg-muted">
                    {t("correctAnswer")}:{" "}
                    <span className="text-success-strong">{q.options[q.correctIndex]}</span>
                  </p>
                </div>
              ) : null}

              <Link
                href={`/knowledge/${q.knowledgeId}`}
                className="inline-flex w-fit items-center gap-1 pl-7 text-body-sm font-medium text-link transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                {t("viewKnowledge")}
                <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
