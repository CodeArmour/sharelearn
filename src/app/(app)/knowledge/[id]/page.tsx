import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getKnowledgeById } from "@/data/mock";
import { knowledgeTitle } from "@/types";
import { KnowledgeDetailView } from "@/features/knowledge";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [item, t] = await Promise.all([getKnowledgeById(id), getTranslations("pages.knowledge")]);
  return { title: item ? knowledgeTitle(item) : t("metaFallback") };
}

export default async function KnowledgeDetailPage({ params }: PageProps<"/knowledge/[id]">) {
  const { id } = await params;
  const item = await getKnowledgeById(id);
  if (!item) notFound();

  return <KnowledgeDetailView item={item} />;
}
