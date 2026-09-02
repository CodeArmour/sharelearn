import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout";
import { getCurrentUser } from "@/data/mock";

export const metadata: Metadata = { title: "Vandaag" };

export default async function TodayPage() {
  const user = await getCurrentUser();

  return (
    <PageContainer>
      <PageHeader
        title={`Hallo, ${user.name}`}
        description="Je startpunt voor vandaag: nieuwe kennis toevoegen, snel oefenen en zien wat de groep heeft geleerd."
      />
      <div className="rounded-card border border-dashed border-border-default bg-surface p-10 text-center">
        <p className="text-body text-fg-muted">
          Het Vandaag-scherm wordt als eerste echte pagina gebouwd, na goedkeuring van deze
          fundering.
        </p>
      </div>
    </PageContainer>
  );
}
