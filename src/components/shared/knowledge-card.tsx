import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { KnowledgeItem, KnowledgeType } from "@/types";
import { knowledgeSnippet, knowledgeTitle } from "@/types";
import { cn } from "@/lib/utils/cn";

import { KnowledgeTypeBadge } from "./knowledge-type-badge";
import { MetaRow } from "./meta-row";

/**
 * KnowledgeCard — a library item preview. Maps to the Figma `KnowledgeCard`
 * (Type = Vocabulary | Grammar | Reading | File). The whole card links to the
 * item's detail page. Vocabulary terms get the vocabulary accent colour so they
 * read as the hero of the card.
 *
 * The Figma "…" overflow menu is deferred until a Menu/Dropdown primitive and
 * its actions (mark for review, edit, remove) exist.
 */
const TITLE_CLASS: Record<KnowledgeType, string> = {
  vocabulary: "font-display text-h3 font-semibold text-knowledge-vocabulary-strong",
  grammar: "font-display text-h3 text-fg",
  reading: "font-display text-h3 text-fg",
  file: "block truncate font-display text-h3 text-fg",
  note: "font-display text-h3 text-fg",
};

export async function KnowledgeCard({
  item,
  className,
}: {
  item: KnowledgeItem;
  className?: string;
}) {
  const t = await getTranslations("knowledge");
  const snippet = knowledgeSnippet(item, { words: t("words") });

  return (
    <Link
      href={`/knowledge/${item.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-card border border-border bg-surface p-5",
        "transition-shadow hover:shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <KnowledgeTypeBadge type={item.type} />
      </div>

      <h3 className={cn(TITLE_CLASS[item.type], "group-hover:underline")}>
        {knowledgeTitle(item)}
      </h3>

      <p className="line-clamp-2 text-body-sm text-fg-secondary">{snippet}</p>

      <div className="h-px w-full bg-border" />

      <MetaRow addedBy={item.addedBy} date={item.createdAt} />
    </Link>
  );
}
