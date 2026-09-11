"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";

import { generateExamQuestionsAction } from "@/server/actions/practice";
import { recordStudyRunAction } from "@/server/actions/personal";
import type {
  PracticeFilter,
  PracticeQuestion,
  PracticeScope,
  PracticeSetup,
  StudyRunInput,
} from "@/types";
import { buildStudyRunInput, type SaveState } from "@/lib/study-run";
import { useReviewMarks } from "@/lib/review-marks";
import { useFocusOnChange } from "@/lib/use-focus-on-change";
import { PageContainer, PageHeader } from "@/components/layout";
import { SetupForm, SetupModeNote } from "@/components/shared";

import { ExamResults } from "./exam-results";
import { ExamSession } from "./exam-session";

type Phase =
  | { name: "setup" }
  | { name: "session"; questions: PracticeQuestion[]; startedAtMs: number }
  | {
      name: "results";
      questions: PracticeQuestion[];
      answers: (number | null)[];
      startedAtMs: number;
    };

/** Exam as a three-phase client machine: setup → paper → results. In-memory only. */
export function ExamView({
  initialScope = "all",
  initialFilter,
  filterSummary,
  levels,
}: {
  initialScope?: PracticeScope;
  initialFilter?: PracticeFilter;
  filterSummary?: string;
  levels: string[];
}) {
  const tPage = useTranslations("pages.exam");
  const tExamSetup = useTranslations("exam.setup");

  const [setup, setSetup] = useState<PracticeSetup>({
    mode: "mixed",
    scope: initialScope,
    filter: initialFilter,
    length: 20,
  });
  const [preview, setPreview] = useState<PracticeQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "setup" });
  const [reviewMarks] = useReviewMarks();

  const startedAtRef = useRef<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const lastRunRef = useRef<StudyRunInput | null>(null);

  const regionRef = useRef<HTMLDivElement>(null);
  useFocusOnChange(regionRef, phase.name);

  const resolved: PracticeSetup = { ...setup, reviewIds: Array.from(reviewMarks) };

  useEffect(() => {
    let alive = true;
    generateExamQuestionsAction(resolved)
      .then((result) => {
        if (!alive) return;
        if (result.ok) {
          setPreview(result.data);
        } else {
          console.error("generateExamQuestionsAction failed:", result.code, result.message);
        }
      })
      .catch((error: unknown) => {
        if (alive) console.error("generateExamQuestionsAction threw:", error);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, reviewMarks]);

  const saveRun = (answers: (number | null)[], questions: PracticeQuestion[]) => {
    const input = buildStudyRunInput({
      kind: "exam",
      setup: { mode: setup.mode, scope: setup.scope, level: setup.level },
      questions,
      answers,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
    });
    lastRunRef.current = input;
    setSaveState("saving");
    void recordStudyRunAction(input)
      .then((r) => setSaveState(r.ok ? "saved" : "error"))
      .catch(() => setSaveState("error"));
  };

  const retrySave = () => {
    if (!lastRunRef.current) return;
    setSaveState("saving");
    void recordStudyRunAction(lastRunRef.current)
      .then((r) => setSaveState(r.ok ? "saved" : "error"))
      .catch(() => setSaveState("error"));
  };

  return (
    <PageContainer>
      <div ref={regionRef} tabIndex={-1} className="outline-none">
        {phase.name === "setup" ? (
          <>
            <PageHeader
              title={tPage("title")}
              icon={
                <ClipboardList
                  className="size-7 text-warning-strong lg:size-8"
                  strokeWidth={1.75}
                  aria-hidden
                />
              }
              description={tPage("subtitle")}
            />
            <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-6">
              <SetupModeNote mode="exam" />
              <SetupForm
                setup={setup}
                levels={levels}
                count={preview.length}
                startLabel={tExamSetup("start")}
                accent="warning"
                filterSummary={filterSummary}
                onChange={(patch) => setSetup((s) => ({ ...s, ...patch }))}
                onStart={() => {
                  if (preview.length > 0) {
                    const startedAtMs = Date.now();
                    startedAtRef.current = new Date(startedAtMs).toISOString();
                    setPhase({ name: "session", questions: preview, startedAtMs });
                  }
                }}
              />
            </div>
          </>
        ) : null}

        {phase.name === "session" ? (
          <ExamSession
            questions={phase.questions}
            startedAtMs={phase.startedAtMs}
            length={setup.length}
            onSubmit={(answers) => {
              saveRun(answers, phase.questions);
              setPhase({
                name: "results",
                questions: phase.questions,
                answers,
                startedAtMs: phase.startedAtMs,
              });
            }}
          />
        ) : null}

        {phase.name === "results" ? (
          <ExamResults
            questions={phase.questions}
            answers={phase.answers}
            saveState={saveState}
            onRetrySave={retrySave}
            onAgain={() => {
              setSaveState(null);
              startedAtRef.current = null;
              setPhase({ name: "setup" });
            }}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}
