"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getPracticeQuestions } from "@/data/mock";
import type { PracticeQuestion, PracticeScope, PracticeSetup } from "@/types";
import { PageContainer, PageHeader } from "@/components/layout";

import { PracticeResults } from "./practice-results";
import { PracticeSession } from "./practice-session";
import { PracticeSetupForm } from "./practice-setup";

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
  levels,
}: {
  initialScope: PracticeScope;
  levels: string[];
}) {
  const tPage = useTranslations("pages.practice");

  const [setup, setSetup] = useState<PracticeSetup>({
    mode: "mixed",
    scope: initialScope,
    length: 10,
  });
  const [preview, setPreview] = useState<PracticeQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "setup" });

  useEffect(() => {
    let alive = true;
    getPracticeQuestions(setup).then((qs) => {
      if (alive) setPreview(qs);
    });
    return () => {
      alive = false;
    };
  }, [setup]);

  return (
    <PageContainer>
      {phase.name === "setup" ? (
        <>
          <PageHeader title={tPage("title")} description={tPage("subtitle")} />
          <div className="mx-auto w-full max-w-[42rem]">
            <PracticeSetupForm
              setup={setup}
              levels={levels}
              count={preview.length}
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
    </PageContainer>
  );
}
