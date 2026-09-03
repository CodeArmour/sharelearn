"use client";

import { useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import { useTranslations } from "next-intl";

import { getPracticeQuestions } from "@/data/mock";
import type { PracticeFilter, PracticeQuestion, PracticeScope, PracticeSetup } from "@/types";
import { useReviewMarks } from "@/lib/review-marks";
import { useFocusOnChange } from "@/lib/use-focus-on-change";
import { PageContainer, PageHeader } from "@/components/layout";
import { SetupForm, SetupModeNote } from "@/components/shared";

import { PracticeResults } from "./practice-results";
import { PracticeSession } from "./practice-session";

type Phase =
  | { name: "setup" }
  | { name: "session"; questions: PracticeQuestion[] }
  | { name: "results"; questions: PracticeQuestion[]; answers: (number | null)[] };

/**
 * Practice as a three-phase client machine: setup → session → results → setup.
 * A run is entirely in-memory (refresh restarts); nothing is persisted yet.
 */
export function PracticeView({
  initialScope,
  initialFilter,
  filterSummary,
  levels,
}: {
  initialScope: PracticeScope;
  initialFilter?: PracticeFilter;
  filterSummary?: string;
  levels: string[];
}) {
  const tPage = useTranslations("pages.practice");
  const tSetup = useTranslations("practice.setup");

  const [setup, setSetup] = useState<PracticeSetup>({
    mode: "mixed",
    scope: initialScope,
    filter: initialFilter,
    length: 10,
  });
  const [preview, setPreview] = useState<PracticeQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "setup" });
  const [reviewMarks] = useReviewMarks();

  const regionRef = useRef<HTMLDivElement>(null);
  useFocusOnChange(regionRef, phase.name);

  const resolved: PracticeSetup = { ...setup, reviewIds: Array.from(reviewMarks) };

  useEffect(() => {
    let alive = true;
    getPracticeQuestions(resolved).then((qs) => {
      if (alive) setPreview(qs);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, reviewMarks]);

  return (
    <PageContainer>
      <div ref={regionRef} tabIndex={-1} className="outline-none">
        {phase.name === "setup" ? (
          <>
            <PageHeader
              title={tPage("title")}
              icon={
                <Target
                  className="size-7 text-info-strong lg:size-8"
                  strokeWidth={1.75}
                  aria-hidden
                />
              }
              description={tPage("subtitle")}
            />
            <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-6">
              <SetupModeNote mode="practice" />
              <SetupForm
                setup={setup}
                levels={levels}
                count={preview.length}
                startLabel={tSetup("start")}
                filterSummary={filterSummary}
                onChange={(patch) => setSetup((s) => ({ ...s, ...patch }))}
                onStart={() => {
                  if (preview.length > 0) setPhase({ name: "session", questions: preview });
                }}
              />
            </div>
          </>
        ) : null}

        {phase.name === "session" ? (
          <PracticeSession
            questions={phase.questions}
            onComplete={(answers) =>
              setPhase({ name: "results", questions: phase.questions, answers })
            }
          />
        ) : null}

        {phase.name === "results" ? (
          <PracticeResults
            questions={phase.questions}
            answers={phase.answers}
            onAgain={() => setPhase({ name: "setup" })}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}
