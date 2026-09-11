import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";

import { OptionButton, type OptionState } from "@/components/shared/option-button";

import { FeedbackPanel } from "./feedback-panel";

/**
 * One practice question: its instruction, prompt, answer options, and — once a
 * choice is locked in — the correct/incorrect feedback. Used both for a
 * standalone vocab/grammar question and for each question inside a reading block,
 * so it is the single place a question is rendered during a run.
 */
export function QuestionCard({
  question,
  picked,
  onPick,
}: {
  question: PracticeQuestion;
  /** The chosen option index, or null while unanswered. */
  picked: number | null;
  onPick: (optionIndex: number) => void;
}) {
  const t = useTranslations("practice");
  const answered = picked !== null;

  const instruction = {
    meaningOf: t("instruction.meaningOf"),
    sayInDutch: t("instruction.sayInDutch"),
    whichRule: t("instruction.whichRule"),
    readComprehension: t("instruction.readComprehension"),
    trueOrFalse: t("instruction.trueOrFalse"),
  }[question.instructionKey];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-label text-fg-muted">{instruction}</span>
        <p className="font-display text-term text-fg">{question.prompt}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {question.options.map((opt, i) => {
          let state: OptionState = "idle";
          if (answered) {
            if (i === question.correctIndex) state = "correct";
            else if (i === picked) state = "wrong";
            else state = "muted";
          }
          return (
            <OptionButton
              key={opt}
              label={opt}
              state={state}
              disabled={answered}
              onClick={() => onPick(i)}
            />
          );
        })}
      </div>

      {answered ? (
        <FeedbackPanel
          correct={picked === question.correctIndex}
          correctAnswer={question.options[question.correctIndex]}
          knowledgeId={question.knowledgeId}
        />
      ) : null}
    </div>
  );
}
