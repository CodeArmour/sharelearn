import type { ReactNode } from "react";

import { PageContainer, PageHeader } from "@/components/layout";

/**
 * Temporary stub for routes whose real UI is scheduled for a later phase.
 * Keeps navigation whole while the shell is verified.
 */
export function PlaceholderPage({
  title,
  description,
  note = "Dit scherm wordt in een latere fase gebouwd.",
}: {
  title: string;
  description?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <div className="rounded-card border border-dashed border-border-default bg-surface p-10 text-center">
        <p className="text-body text-fg-muted">{note}</p>
      </div>
    </PageContainer>
  );
}
