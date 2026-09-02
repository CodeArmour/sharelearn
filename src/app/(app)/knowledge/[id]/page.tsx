import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getKnowledgeById } from "@/data/mock";
import { knowledgeTitle } from "@/types";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [item, t] = await Promise.all([getKnowledgeById(id), getTranslations("pages.knowledge")]);
  return { title: item ? knowledgeTitle(item) : t("metaFallback") };
}

export default async function KnowledgeDetailPage({ params }: PageProps<"/knowledge/[id]">) {
  const { id } = await params;
  const [item, t] = await Promise.all([getKnowledgeById(id), getTranslations("pages.knowledge")]);
  if (!item) notFound();

  return (
    <PlaceholderPage
      title={knowledgeTitle(item)}
      description={t("attribution", { type: item.type, name: item.addedBy.name })}
      note={t("note")}
    />
  );
}
