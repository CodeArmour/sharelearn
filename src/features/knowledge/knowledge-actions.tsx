"use client";

import Link from "next/link";
import { Bookmark, Target } from "lucide-react";
import { useTranslations } from "next-intl";

import { useReviewMarks } from "@/lib/review-marks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * The two things you can do with a knowledge item from its detail page: jump
 * into practice, or flag it for review. Practice is only offered for the types
 * that generate questions (vocabulary, grammar, reading). Review marks are
 * personal state, persisted in `localStorage` until the backend exists, and
 * shared with the Library table and the Practice/Exam "review" scope.
 */
export function KnowledgeActions({
  knowledgeId,
  practiseable,
}: {
  knowledgeId: string;
  practiseable: boolean;
}) {
  const t = useTranslations("knowledge.detail");
  const [marks, toggle] = useReviewMarks();
  const marked = marks.has(knowledgeId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {practiseable ? (
        <Link href="/practice" className={buttonVariants({ variant: "primary", size: "md" })}>
          <Target className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("practise")}
        </Link>
      ) : null}

      <button
        type="button"
        onClick={() => toggle(knowledgeId)}
        aria-pressed={marked}
        className={cn(
          buttonVariants({ variant: marked ? "secondary" : "outline", size: "md" }),
          marked && "text-knowledge-vocabulary-strong",
        )}
      >
        <Bookmark
          className="-ml-0.5 size-[18px]"
          strokeWidth={2}
          fill={marked ? "currentColor" : "none"}
          aria-hidden
        />
        {marked ? t("marked") : t("markReview")}
      </button>
    </div>
  );
}
