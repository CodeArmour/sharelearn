import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  FileUp,
  type LucideIcon,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { KnowledgeItem, KnowledgeSource, KnowledgeType } from "@/types";
import { knowledgeTitle } from "@/types";
import { getKnowledgeByIds } from "@/data/mock";
import { PageContainer } from "@/components/layout";
import { KnowledgeTypeBadge, MetaRow } from "@/components/shared";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { FileDetail } from "./file-detail";
import { GrammarDetail } from "./grammar-detail";
import { KnowledgeActions } from "./knowledge-actions";
import { NoteDetail } from "./note-detail";
import { ReadingDetail } from "./reading-detail";
import { VocabularyDetail } from "./vocabulary-detail";

const SOURCE_ICON: Record<KnowledgeSource, LucideIcon> = {
  manual: PencilLine,
  photo: Camera,
  "file-upload": FileUp,
  "ai-assisted": Sparkles,
};

const TITLE_CLASS: Record<KnowledgeType, string> = {
  vocabulary: "font-display text-term text-knowledge-vocabulary-strong",
  grammar: "font-display text-h1 text-fg",
  reading: "font-display text-h1 text-fg",
  file: "font-display text-h1 break-all text-fg",
  note: "font-display text-h1 text-fg",
};

/**
 * Knowledge Detail (`/knowledge/[id]`) — one shared library item in full, with
 * a body that switches on the item's type. Attribution and the "practise / mark
 * for review" actions are common to every type.
 */
export async function KnowledgeDetailView({ item }: { item: KnowledgeItem }) {
  const [t, tType, tSource] = await Promise.all([
    getTranslations("knowledge.detail"),
    getTranslations("knowledge.type"),
    getTranslations("knowledge.source"),
  ]);

  const linkedVocabulary =
    item.type === "reading" && item.vocabularyIds.length > 0
      ? await getKnowledgeByIds(item.vocabularyIds)
      : [];

  const heading = knowledgeTitle(item) || tType(item.type);
  const SourceIcon = SOURCE_ICON[item.source];
  const practiseable =
    item.type === "vocabulary" || item.type === "grammar" || item.type === "reading";

  return (
    <PageContainer>
      <div className="mx-auto flex max-w-[45rem] flex-col gap-6">
        <Link
          href="/library"
          className={cn(
            "inline-flex w-fit items-center gap-1.5 text-body-sm text-fg-muted",
            "transition-colors hover:text-fg",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
          )}
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
          {t("back")}
        </Link>

        <header className="flex flex-col gap-3">
          <KnowledgeTypeBadge type={item.type} className="self-start" />
          <h1 className={TITLE_CLASS[item.type]}>{heading}</h1>
          <MetaRow
            addedBy={item.addedBy}
            date={item.createdAt}
            source={{
              icon: <SourceIcon className="size-3" strokeWidth={2} aria-hidden />,
              label: tSource(item.source),
            }}
          />
          {item.level || item.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {item.level ? (
                <Badge tone="info" size="sm">
                  {item.level}
                </Badge>
              ) : null}
              {item.tags.map((tag) => (
                <Badge key={tag} tone="neutral" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        <KnowledgeActions practiseable={practiseable} />

        <div className="h-px w-full bg-border" />

        {item.type === "vocabulary" ? <VocabularyDetail item={item} /> : null}
        {item.type === "grammar" ? <GrammarDetail item={item} /> : null}
        {item.type === "reading" ? (
          <ReadingDetail item={item} linkedVocabulary={linkedVocabulary} />
        ) : null}
        {item.type === "file" ? <FileDetail item={item} /> : null}
        {item.type === "note" ? <NoteDetail item={item} /> : null}
      </div>
    </PageContainer>
  );
}
