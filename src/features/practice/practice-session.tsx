import { useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { useFocusOnChange } from "@/lib/use-focus-on-change";
import { Button } from "@/components/ui";

import { QuestionCard } from "./question-card";
import { ReadingBlock } from "./reading-block";

/**
 * One run step. Vocab/grammar questions are their own step; a reading passage
 * and all its consecutive comprehension questions form one step so the passage
 * stays on screen while every question about it is answered.
 */
type Step =
  | { kind: "single"; qi: number }
  | { kind: "reading"; passageId: string; qis: number[] };

function buildSteps(questions: PracticeQuestion[]): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    const passage = questions[i].passage;
    const last = steps[steps.length - 1];
    if (passage && last?.kind === "reading" && last.passageId === passage.id) {
      last.qis.push(i);
    } else if (passage) {
      steps.push({ kind: "reading", passageId: passage.id, qis: [i] });
    } else {
      steps.push({ kind: "single", qi: i });
    }
  }
  return steps;
}

/** Runs one practice session and hands the answers back when finished. */
export function PracticeSession({
  questions,
  onComplete,
}: {
  questions: PracticeQuestion[];
  onComplete: (answers: (number | null)[]) => void;
}) {
  const t = useTranslations("practice");
  const steps = useMemo(() => buildSteps(questions), [questions]);

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));

  const regionRef = useRef<HTMLDivElement>(null);
  useFocusOnChange(regionRef, stepIndex);

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const stepQis = step.kind === "single" ? [step.qi] : step.qis;
  const stepAnswered = stepQis.every((qi) => answers[qi] !== null);

  const pick = (qi: number, optionIndex: number) => {
    setAnswers((prev) => {
      if (prev[qi] !== null) return prev; // a locked question never changes
      const next = [...prev];
      next[qi] = optionIndex;
      return next;
    });
  };

  const advance = () => {
    if (isLastStep) {
      onComplete(answers);
      return;
    }
    setStepIndex(stepIndex + 1);
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const progress = (answeredCount / questions.length) * 100;

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
          {t("session.progress", { current: answeredCount, total: questions.length })}
        </span>
      </div>

      <div ref={regionRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
        {step.kind === "reading" ? (
          <ReadingBlock
            passage={questions[step.qis[0]].passage!}
            questions={step.qis.map((qi) => questions[qi])}
            indices={step.qis}
            answers={answers}
            onPick={pick}
          />
        ) : (
          <QuestionCard
            question={questions[step.qi]}
            picked={answers[step.qi]}
            onPick={(optionIndex) => pick(step.qi, optionIndex)}
          />
        )}
      </div>

      {stepAnswered ? (
        <Button type="button" size="md" onClick={advance} className="w-fit">
          {isLastStep ? t("session.finish") : t("session.next")}
          <ArrowRight className="-mr-0.5 size-[18px]" strokeWidth={2} aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
