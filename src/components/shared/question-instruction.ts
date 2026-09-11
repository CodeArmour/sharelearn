import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";

/**
 * The short instruction line ("What does this mean?", "Which rule is this an
 * example of?", ...) shown above a question's prompt. Shared by Practice's
 * QuestionCard and Exam's ExamSession so every place a question is rendered
 * tells the learner what to do with it.
 */
export function useQuestionInstruction(key: PracticeQuestion["instructionKey"]): string {
  const t = useTranslations("practice.instruction");
  return t(key);
}
