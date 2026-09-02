import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { KnowledgeItem, ReadingItem } from "@/types";
import { knowledgeTitle } from "@/types";
import { Section } from "@/components/layout";
import { cn } from "@/lib/utils/cn";

/**
 * Full detail for a reading: the Dutch text set in the reading style, plus
 * chips linking to the vocabulary the group pulled from it.
 */
export async function ReadingDetail({
  item,
  linkedVocabulary,
}: {
  item: ReadingItem;
  linkedVocabulary: KnowledgeItem[];
}) {
  const t = await getTranslations("knowledge.detail");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-fg-muted">{t("wordCount", { count: item.wordCount })}</p>
        {item.summary ? (
          <p className="text-body-lg text-fg-secondary">{item.summary}</p>
        ) : null}
      </div>

      <Section title={t("text")}>
        <div className="font-reading text-reading whitespace-pre-line text-fg-secondary">
          {item.body}
        </div>
      </Section>

      {linkedVocabulary.length > 0 ? (
        <Section title={t("linkedVocabulary")}>
          <ul className="flex flex-wrap gap-2">
            {linkedVocabulary.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/knowledge/${v.id}`}
                  className={cn(
                    "inline-flex rounded-pill bg-knowledge-vocabulary-subtle px-3 py-1",
                    "text-body-sm font-medium text-knowledge-vocabulary-strong",
                    "transition-colors hover:underline",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                  )}
                >
                  {knowledgeTitle(v)}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
