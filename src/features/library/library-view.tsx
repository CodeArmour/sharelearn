import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { CEFRLevel, GroupMemberSummary, KnowledgeType } from "@/types";
import type { LibraryQuery, LibraryResult } from "@/data/mock";
import { PageContainer, PageHeader } from "@/components/layout";
import { KnowledgeCard } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";

import { FilterChips } from "./filter-chips";
import { LibraryControls } from "./library-controls";

function toQueryString(query: LibraryQuery, patch: Partial<LibraryQuery>, page?: number) {
  const merged = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.type) sp.set("type", merged.type);
  if (merged.level) sp.set("level", merged.level);
  if (merged.by) sp.set("by", merged.by);
  if (merged.sort && merged.sort !== "newest") sp.set("sort", merged.sort);
  if (page && page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `/library?${s}` : "/library";
}

export async function LibraryView({
  query,
  page,
  result,
  facets,
}: {
  query: LibraryQuery;
  page: number;
  result: LibraryResult;
  facets: { levels: CEFRLevel[]; members: GroupMemberSummary[] };
}) {
  const t = await getTranslations();
  const hasMore = result.items.length < result.total;

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.library")}
        description={t("pages.library.subtitle", { count: result.libraryTotal })}
      />

      <div className="flex flex-col gap-5">
        <LibraryControls levels={facets.levels} members={facets.members} />

        <FilterChips
          active={query.type}
          hrefFor={(type?: KnowledgeType) => toQueryString(query, { type })}
        />

        <p className="text-body-sm text-fg-muted">
          {t("library.results", { count: result.total })}
        </p>

        {result.items.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-default bg-surface p-10 text-center text-body text-fg-muted">
            {t("library.empty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-4 md:gap-5">
            {result.items.map((item) => (
              <KnowledgeCard key={item.id} item={item} className="w-full sm:w-[21.25rem]" />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="pt-1">
            <Link
              href={toQueryString(query, {}, page + 1)}
              scroll={false}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              {t("library.loadMore")}
            </Link>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
