import { getLibraryFacets } from "@/server/services/knowledge-service";
import { titleMetadata } from "@/lib/page-metadata";
import { ExamView } from "@/features/exam";

export const generateMetadata = titleMetadata((t) => t("nav.exam"));

export default async function ExamPage() {
  const facets = await getLibraryFacets();
  return <ExamView levels={facets.levels} />;
}
