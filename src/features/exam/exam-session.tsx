import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { Button } from "@/components/ui";
import { OptionButton, type OptionState, PassagePanel } from "@/components/shared";

/**
 * The exam paper: every question on one scrollable page, no feedback until it
 * is handed in. A sticky footer tracks how many are answered.
 */
export function ExamSession({
  questions,
  onSubmit,
}: {
  questions: PracticeQuestion[];
  onSubmit: (answers: (number | null)[]) => void;
}) {
  const t = useTranslations("exam.session");
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => Array(questions.length).fill(null) as null[],
  );

  const answeredCount = answers.filter((a) => a !== null).length;
  const unanswered = questions.length - answeredCount;

  const pick = (qIndex: number, optIndex: number) =>
    setAnswers((prev) => prev.map((a, i) => (i === qIndex ? optIndex : a)));

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-8">
      {questions.map((q, qi) => {
        const showPassage =
          q.passage != null &&
          (qi === 0 || questions[qi - 1]?.passage?.id !== q.passage.id);
        return (
          <Fragment key={q.id}>
            {showPassage && q.passage ? <PassagePanel passage={q.passage} /> : null}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-label text-fg-muted">
                  {t("questionNumber", { number: qi + 1 })}
                </span>
                <p className="font-display text-h3 text-fg">{q.prompt}</p>
              </div>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => {
                  const state: OptionState = answers[qi] === oi ? "selected" : "idle";
                  return (
                    <OptionButton key={opt} label={opt} state={state} onClick={() => pick(qi, oi)} />
                  );
                })}
              </div>
            </div>
          </Fragment>
        );
      })}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur lg:bottom-0 lg:-mx-12 lg:px-12">
        <Button type="button" size="md" onClick={() => onSubmit(answers)}>
          {t("handIn")}
        </Button>
        <span className="text-body-sm text-fg-muted">
          {t("answered", { answered: answeredCount, total: questions.length })}
          {unanswered > 0 ? ` · ${t("unanswered", { count: unanswered })}` : ""}
        </span>
      </div>
    </div>
  );
}
