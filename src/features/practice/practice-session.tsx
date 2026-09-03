import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { Button } from "@/components/ui";

import { OptionButton, type OptionState } from "@/components/shared/option-button";

import { FeedbackPanel } from "./feedback-panel";

/** Runs one practice session and hands the answers back when finished. */
export function PracticeSession({
  questions,
  onComplete,
}: {
  questions: PracticeQuestion[];
  onComplete: (answers: (number | null)[]) => void;
}) {
  const t = useTranslations("practice");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const q = questions[index];
  const answered = selected !== null;
  const isLast = index === questions.length - 1;

  const instruction = {
    meaningOf: t("instruction.meaningOf"),
    sayInDutch: t("instruction.sayInDutch"),
    whichRule: t("instruction.whichRule"),
  }[q.instructionKey];

  const next = () => {
    const all = [...answers, selected];
    if (isLast) {
      onComplete(all);
      return;
    }
    setAnswers(all);
    setIndex(index + 1);
    setSelected(null);
  };

  const progress = ((index + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="mx-auto flex max-w-[42rem] flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
          <div
            className="h-full rounded-pill bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-body-sm text-fg-muted">
          {t("session.progress", { current: index + 1, total: questions.length })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label text-fg-muted">{instruction}</span>
        <p className="font-display text-term text-fg">{q.prompt}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {q.options.map((opt, i) => {
          let state: OptionState = "idle";
          if (answered) {
            if (i === q.correctIndex) state = "correct";
            else if (i === selected) state = "wrong";
            else state = "muted";
          }
          return (
            <OptionButton
              key={opt}
              label={opt}
              state={state}
              disabled={answered}
              onClick={() => setSelected(i)}
            />
          );
        })}
      </div>

      {answered ? (
        <>
          <FeedbackPanel
            correct={selected === q.correctIndex}
            correctAnswer={q.options[q.correctIndex]}
            knowledgeId={q.knowledgeId}
          />
          <Button type="button" size="md" onClick={next} className="w-fit">
            {isLast ? t("session.finish") : t("session.next")}
            <ArrowRight className="-mr-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          </Button>
        </>
      ) : null}
    </div>
  );
}
