import Link from "next/link";
import { ClipboardList, Target } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CEFRLevel, GroupMemberSummary, KnowledgeType, VocabularyItem } from "@/types";
import type { LibraryQuery, LibraryResult } from "@/server/services/knowledge-service";
import { PageContainer, PageHeader } from "@/components/layout";
import { KnowledgeCard } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";

import { FilterChips } from "./filter-chips";
import { LibraryControls } from "./library-controls";
import { LibraryViewToggle } from "./library-view-toggle";
import { VocabularyTable } from "./vocabulary-table";

export type LibraryViewMode = "cards" | "table";

type HrefPatch = Partial<LibraryQuery & { view: LibraryViewMode; page: number }>;

/** Carry the active Library filter to /practice or /exam as a "custom" scope. */
function drillHref(base: string, query: LibraryQuery): string {
  const sp = new URLSearchParams();
  if (query.q) sp.set("q", query.q);
  if (query.type) sp.set("type", query.type);
  if (query.level) sp.set("level", query.level);
  if (query.by) sp.set("by", query.by);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

function hrefBuilder(query: LibraryQuery, view: LibraryViewMode) {
  return (patch: HrefPatch) => {
    const merged = { ...query, view, ...patch };
    const sp = new URLSearchParams();
    if (merged.q) sp.set("q", merged.q);
    if (merged.type) sp.set("type", merged.type);
    if (merged.level) sp.set("level", merged.level);
    if (merged.by) sp.set("by", merged.by);
    if (merged.sort && merged.sort !== "newest") sp.set("sort", merged.sort);
    // The table view only applies to the vocabulary filter.
    if (merged.view === "table" && merged.type === "vocabulary") sp.set("view", "table");
    if (patch.page && patch.page > 1) sp.set("page", String(patch.page));
    const s = sp.toString();
    return s ? `/library?${s}` : "/library";
  };
}

export async function LibraryView({
  query,
  view,
  page,
  result,
  facets,
}: {
  query: LibraryQuery;
  view: LibraryViewMode;
  page: number;
  result: LibraryResult;
  facets: { levels: CEFRLevel[]; members: GroupMemberSummary[] };
}) {
  const t = await getTranslations();
  const href = hrefBuilder(query, view);

  // Cards/Table switching is only offered for the vocabulary filter.
  const canUseTable = query.type === "vocabulary";
  const effectiveView: LibraryViewMode = canUseTable && view === "table" ? "table" : "cards";

  const hasMore = result.items.length < result.total;
  const vocab = result.items.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const hasActiveFilter = Boolean(query.q || query.type || query.level || query.by);

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.library")}
        description={t("pages.library.subtitle", { count: result.libraryTotal })}
      />

      <div className="flex flex-col gap-5">
        <LibraryControls levels={facets.levels} members={facets.members} />

        <FilterChips active={query.type} hrefFor={(type?: KnowledgeType) => href({ type })} />

        <div key={`${effectiveView}:${query.type ?? "all"}`} className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-body-sm text-fg-muted">
                {t("library.results", {
                  count: effectiveView === "table" ? vocab.length : result.total,
                })}
              </p>
              {hasActiveFilter && result.total > 0 && (
                <div className="flex gap-2">
                  <Link
                    href={drillHref("/practice", query)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Target className="-ml-0.5 size-4" strokeWidth={1.75} aria-hidden />
                    {t("library.practiseThese")}
                  </Link>
                  <Link
                    href={drillHref("/exam", query)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ClipboardList className="-ml-0.5 size-4" strokeWidth={1.75} aria-hidden />
                    {t("library.examThese")}
                  </Link>
                </div>
              )}
            </div>
            {canUseTable && (
              <LibraryViewToggle view={effectiveView} hrefFor={(v) => href({ view: v })} />
            )}
          </div>

          {effectiveView === "table" ? (
            vocab.length > 0 ? (
              <VocabularyTable items={vocab} />
            ) : (
              <p className="rounded-card border border-dashed border-border-default bg-surface p-10 text-center text-body text-fg-muted">
                {t("library.empty")}
              </p>
            )
          ) : result.items.length === 0 ? (
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

          {effectiveView === "cards" && hasMore && (
            <div className="pt-1">
              <Link
                href={href({ page: page + 1 })}
                scroll={false}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                {t("library.loadMore")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
