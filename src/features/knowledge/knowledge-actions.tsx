"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Target } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * The two things you can do with a knowledge item from its detail page:
 * jump into practice, or flag it for review. Practice is only offered for the
 * types that generate questions (vocabulary, grammar, reading). "Mark for
 * review" is local state only — there is no personal-data backend yet, so it
 * resets on reload (same limitation as the Library study-mode table).
 */
export function KnowledgeActions({ practiseable }: { practiseable: boolean }) {
  const t = useTranslations("knowledge.detail");
  const [marked, setMarked] = useState(false);

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
        onClick={() => setMarked((m) => !m)}
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
