import {
  getLibraryFacets,
  getLibraryItems,
  type LibraryQuery,
  type LibrarySort,
} from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";
import { isCEFRLevel, KNOWLEDGE_TYPES, type KnowledgeType } from "@/types";
import { LibraryView } from "@/features/library";

export const generateMetadata = titleMetadata((t) => t("nav.library"));

const SORTS: LibrarySort[] = ["newest", "oldest", "az"];

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const sp = await searchParams;

  const type = first(sp.type);
  const level = first(sp.level);
  const sort = first(sp.sort);
  const query: LibraryQuery = {
    q: first(sp.q),
    type: (KNOWLEDGE_TYPES as readonly string[]).includes(type ?? "")
      ? (type as KnowledgeType)
      : undefined,
    level: isCEFRLevel(level) ? level : undefined,
    by: first(sp.by),
    sort: (SORTS as string[]).includes(sort ?? "") ? (sort as LibrarySort) : undefined,
  };
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);
  const view = first(sp.view) === "table" ? "table" : "cards";

  const [result, facets] = await Promise.all([getLibraryItems(query, page), getLibraryFacets()]);

  return <LibraryView query={query} view={view} page={page} result={result} facets={facets} />;
}
