import type { PracticeQuestion } from "@/types";

import { PassagePanel } from "@/components/shared";

import { QuestionCard } from "./question-card";

/**
 * A whole reading passage as a single practice step: the passage once at the
 * top, then every comprehension question for it stacked below with its own
 * options and instant feedback. The parent advances only once all of them are
 * answered.
 */
export function ReadingBlock({
  passage,
  questions,
  indices,
  answers,
  onPick,
}: {
  passage: { id: string; title: string; body: string };
  /** The questions for this passage, in order. */
  questions: PracticeQuestion[];
  /** `indices[k]` is the position of `questions[k]` in the full run list. */
  indices: number[];
  /** The full run answer list — read by original index. */
  answers: (number | null)[];
  onPick: (originalIndex: number, optionIndex: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PassagePanel passage={passage} />
      {questions.map((question, k) => (
        <QuestionCard
          key={question.id}
          question={question}
          picked={answers[indices[k]]}
          onPick={(optionIndex) => onPick(indices[k], optionIndex)}
        />
      ))}
    </div>
  );
}
