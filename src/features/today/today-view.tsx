import type { KnowledgeItem } from "@/types";
import type { TodayFeed } from "@/data/mock";
import { PageContainer, PageHeader } from "@/components/layout";
import { KnowledgeCard } from "@/components/shared";

import { CaptureBar } from "./components/capture-bar";
import { QuickPracticeCard } from "./components/quick-practice-card";
import { TodaySection } from "./components/today-section";

function CardGrid({ items }: { items: KnowledgeItem[] }) {
  // Fixed-width cards that pack left and wrap — matches the Figma card size
  // rather than stretching to fill the row.
  return (
    <div className="flex flex-wrap gap-4 md:gap-5">
      {items.map((item) => (
        <KnowledgeCard key={item.id} item={item} className="w-full sm:w-[21.25rem]" />
      ))}
    </div>
  );
}

/**
 * Today — the group's home surface: capture entry, everything added today
 * grouped by kind, and a quick-practice call-to-action.
 */
export function TodayView({ feed, subtitle }: { feed: TodayFeed; subtitle: string }) {
  const nothingToday =
    feed.vocabulary.length + feed.grammar.length + feed.textsAndFiles.length === 0;

  return (
    <PageContainer>
      <PageHeader title="Vandaag" description={subtitle} />

      <div className="flex flex-col gap-6 lg:gap-8">
        <CaptureBar />

        {feed.vocabulary.length > 0 && (
          <TodaySection title="Woordenschat van vandaag" count={feed.vocabulary.length}>
            <CardGrid items={feed.vocabulary} />
          </TodaySection>
        )}

        {feed.grammar.length > 0 && (
          <TodaySection title="Grammatica van vandaag" count={feed.grammar.length}>
            <CardGrid items={feed.grammar} />
          </TodaySection>
        )}

        {feed.textsAndFiles.length > 0 && (
          <TodaySection title="Teksten & bestanden" count={feed.textsAndFiles.length}>
            <CardGrid items={feed.textsAndFiles} />
          </TodaySection>
        )}

        {nothingToday && (
          <p className="rounded-card border border-dashed border-border-default bg-surface p-8 text-center text-body text-fg-muted">
            Nog niets toegevoegd vandaag. Begin hierboven.
          </p>
        )}

        {feed.practice.itemCount > 0 && (
          <QuickPracticeCard
            itemCount={feed.practice.itemCount}
            questionCount={feed.practice.questionCount}
            minutes={feed.practice.minutes}
          />
        )}
      </div>
    </PageContainer>
  );
}
