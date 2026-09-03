import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

/**
 * Post-answer feedback — maps to the Figma Feedback States. Correctness is
 * carried by an icon, a word and a colour (never colour alone), and always
 * links back to the knowledge that generated the question.
 */
export function FeedbackPanel({
  correct,
  correctAnswer,
  knowledgeId,
}: {
  correct: boolean;
  correctAnswer: string;
  knowledgeId: string;
}) {
  const t = useTranslations("practice.feedback");

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-card border-l-4 p-4",
        correct ? "border-success bg-success-subtle" : "border-error bg-error-subtle",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-2 font-display text-h3",
          correct ? "text-success-strong" : "text-error-strong",
        )}
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-pill text-on-primary",
            correct ? "bg-success" : "bg-error",
          )}
        >
          {correct ? (
            <Check className="size-4" strokeWidth={3} aria-hidden />
          ) : (
            <X className="size-4" strokeWidth={3} aria-hidden />
          )}
        </span>
        {correct ? t("correct") : t("incorrect")}
      </span>

      {!correct ? (
        <p className="text-body-sm">
          <span className="text-fg-muted">{t("correctAnswer")}: </span>
          <span className="font-medium text-fg">{correctAnswer}</span>
        </p>
      ) : null}

      <Link
        href={`/knowledge/${knowledgeId}`}
        className="inline-flex w-fit items-center gap-1 text-body-sm font-medium text-link transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        {t("viewKnowledge")}
        <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
      </Link>
    </div>
  );
}
