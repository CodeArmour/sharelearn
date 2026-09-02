import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getKnowledgeById } from "@/data/mock";
import { knowledgeTitle } from "@/types";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]">): Promise<Metadata> {
  const { id } = await params;
  const item = await getKnowledgeById(id);
  return { title: item ? knowledgeTitle(item) : "Kennis" };
}

export default async function KnowledgeDetailPage({ params }: PageProps<"/knowledge/[id]">) {
  const { id } = await params;
  const item = await getKnowledgeById(id);
  if (!item) notFound();

  return (
    <PlaceholderPage
      title={knowledgeTitle(item)}
      description={`Type: ${item.type} · toegevoegd door ${item.addedBy.name}`}
      note="Kennisdetail (met uitleg, voorbeelden en 'oefen dit') volgt na Bibliotheek."
    />
  );
}
