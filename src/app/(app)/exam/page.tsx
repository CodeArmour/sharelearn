import { getLibraryFacets } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";
import { buildFilterSummary, parsePracticeFilter } from "@/lib/practice-scope";
import { ExamView } from "@/features/exam";

export const generateMetadata = titleMetadata((t) => t("nav.exam"));

export default async function ExamPage({ searchParams }: PageProps<"/exam">) {
  const sp = await searchParams;
  const facets = await getLibraryFacets();

  const filter = parsePracticeFilter(sp);
  if (filter) {
    const summary = await buildFilterSummary(filter, facets.members);
    return (
      <ExamView
        initialScope="custom"
        initialFilter={filter}
        filterSummary={summary}
        levels={facets.levels}
      />
    );
  }

  return <ExamView levels={facets.levels} />;
}
