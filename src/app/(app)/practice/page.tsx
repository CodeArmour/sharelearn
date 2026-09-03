import { getLibraryFacets } from "@/data/mock";
import { titleMetadata } from "@/lib/page-metadata";
import type { PracticeScope } from "@/types";
import { PracticeView } from "@/features/practice";

export const generateMetadata = titleMetadata((t) => t("nav.practice"));

const SCOPES = ["all", "today", "level"];

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.scope) ? sp.scope[0] : sp.scope;
  const initialScope = (SCOPES.includes(raw ?? "") ? raw : "all") as PracticeScope;

  const facets = await getLibraryFacets();

  return <PracticeView initialScope={initialScope} levels={facets.levels} />;
}
