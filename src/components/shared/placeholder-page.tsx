import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { PageContainer, PageHeader } from "@/components/layout";

/**
 * Temporary stub for routes whose real UI is scheduled for a later phase.
 * Keeps navigation whole while earlier screens are built.
 */
export async function PlaceholderPage({
  title,
  description,
  note,
}: {
  title: string;
  description?: ReactNode;
  note?: ReactNode;
}) {
  const t = await getTranslations("common");

  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <div className="rounded-card border border-dashed border-border-default bg-surface p-10 text-center">
        <p className="text-body text-fg-muted">{note ?? t("comingSoon")}</p>
      </div>
    </PageContainer>
  );
}
