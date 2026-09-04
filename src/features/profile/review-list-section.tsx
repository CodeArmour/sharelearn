"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";

import type { KnowledgeItem, KnowledgeType } from "@/types";
import { knowledgeSnippet, knowledgeTitle } from "@/types";
import { resolveKnowledgeByIdsAction } from "@/server/actions/knowledge";
import { useReviewMarks } from "@/lib/review-marks";
import { Section } from "@/components/layout";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const TYPE_CHIP: Record<KnowledgeType, string> = {
  vocabulary: "bg-knowledge-vocabulary-subtle text-knowledge-vocabulary-strong",
  grammar: "bg-knowledge-grammar-subtle text-knowledge-grammar-strong",
  reading: "bg-knowledge-reading-subtle text-knowledge-reading-strong",
  file: "bg-knowledge-file-subtle text-knowledge-file-strong",
  note: "bg-surface-sunken text-fg-secondary",
};

/** The items you've marked for review — the substantive part of the page. */
export function ReviewListSection() {
  const t = useTranslations("profile.review");
  const tType = useTranslations("knowledge.type");
  const tKnowledge = useTranslations("knowledge");
  const [marks, toggle] = useReviewMarks();
  const [items, setItems] = useState<KnowledgeItem[]>([]);

  useEffect(() => {
    let alive = true;
    resolveKnowledgeByIdsAction(Array.from(marks)).then((result) => {
      if (alive && result.ok) setItems(result.data);
    });
    return () => {
      alive = false;
    };
  }, [marks]);

  return (
    <Section
      title={t("title")}
      actions={
        marks.size > 0 ? (
          <Link
            href="/practice?scope=review"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("practise")}
          </Link>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-default bg-surface p-8 text-center text-body-sm text-fg-muted">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span
                className={cn(
                  "shrink-0 rounded-pill px-2 py-0.5 text-caption font-medium",
                  TYPE_CHIP[item.type],
                )}
              >
                {tType(item.type)}
              </span>
              <Link
                href={`/knowledge/${item.id}`}
                className="flex min-w-0 flex-1 flex-col rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <span className="truncate font-medium text-fg">{knowledgeTitle(item)}</span>
                <span className="truncate text-body-sm text-fg-muted">
                  {knowledgeSnippet(item, { words: tKnowledge("words") })}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-label={t("remove")}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-knowledge-vocabulary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
              >
                <Bookmark className="size-4" strokeWidth={1.75} fill="currentColor" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
