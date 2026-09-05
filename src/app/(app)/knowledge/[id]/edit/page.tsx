import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AddKnowledgeView } from "@/features/add";
import { getKnowledgeById } from "@/server/services/knowledge-service";
import { resolveActiveContext } from "@/server/services/session-service";
import { knowledgeTitle } from "@/types";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const [item, t] = await Promise.all([getKnowledgeById(id), getTranslations("pages.knowledge")]);
  return { title: item ? knowledgeTitle(item) : t("metaFallback") };
}

export default async function EditKnowledgePage({ params }: PageProps<"/knowledge/[id]/edit">) {
  const { id } = await params;
  const item = await getKnowledgeById(id);
  if (!item) notFound();

  const ctx = await resolveActiveContext();
  const canModify =
    ctx.status === "ok" && (item.addedBy.id === ctx.user.id || ctx.membership.role === "owner");
  if (!canModify) redirect(`/knowledge/${id}`);

  return <AddKnowledgeView existingItem={item} />;
}
