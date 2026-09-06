import type {
  CEFRLevel,
  PracticeQuestion,
  PracticeSetup,
  StudyRunInput,
  StudyRunKind,
} from "@/types";

/** Results-screen persistence state for a finished practice/exam run. */
export type SaveState = "saving" | "saved" | "error";

/** Turn a finished session into the payload `recordStudyRunAction` expects. */
export function buildStudyRunInput(args: {
  kind: StudyRunKind;
  setup: Pick<PracticeSetup, "mode" | "scope"> & { level?: string };
  questions: PracticeQuestion[];
  answers: (number | null)[];
  startedAt: string;
}): StudyRunInput {
  const correctCount = args.answers.filter(
    (a, i) => a !== null && a === args.questions[i]?.correctIndex,
  ).length;
  return {
    kind: args.kind,
    mode: args.kind === "exam" ? null : args.setup.mode,
    scope: args.setup.scope,
    level:
      args.setup.scope === "level"
        ? ((args.setup.level ?? null) as CEFRLevel | null)
        : null,
    questionCount: args.questions.length,
    correctCount,
    startedAt: args.startedAt,
    completedAt: new Date().toISOString(),
  };
}
