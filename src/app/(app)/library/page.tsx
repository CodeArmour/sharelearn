import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shared/placeholder-page";
import { getLibraryStats } from "@/data/mock";

export const metadata: Metadata = { title: "Bibliotheek" };

export default async function LibraryPage() {
  const stats = await getLibraryStats();
  return (
    <PlaceholderPage
      title="Bibliotheek"
      description={`${stats.total} items · alles wat de groep tot nu toe heeft geleerd.`}
      note="Bibliotheek (kaarten- en woordenschattabelweergave met studiemodus) volgt na Vandaag."
    />
  );
}
