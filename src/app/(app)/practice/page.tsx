import { getLibraryFacets } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";
import { buildFilterSummary, parsePracticeFilter } from "@/lib/practice-scope";
import type { PracticeScope } from "@/types";
import { PracticeView } from "@/features/practice";

export const generateMetadata = titleMetadata((t) => t("nav.practice"));

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const sp = await searchParams;
  const facets = await getLibraryFacets();

  const filter = parsePracticeFilter(sp);
  if (filter) {
    const summary = await buildFilterSummary(filter, facets.members);
    return (
      <PracticeView
        initialScope="custom"
        initialFilter={filter}
        filterSummary={summary}
        levels={facets.levels}
      />
    );
  }

  const scopeParam = Array.isArray(sp.scope) ? sp.scope[0] : sp.scope;
  const initialScope: PracticeScope =
    scopeParam === "today" ? "today" : scopeParam === "review" ? "review" : "all";
  return <PracticeView initialScope={initialScope} levels={facets.levels} />;
}
