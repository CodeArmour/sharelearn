import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) =>
    v ? `${k}:${JSON.stringify(v)}` : k,
}));

import type { KnowledgeType, StudyHistory } from "@/types";

import { ProgressSection } from "./progress-section";

const libraryStats = {
  vocabulary: 5,
  grammar: 3,
  reading: 1,
  file: 0,
  note: 1,
  total: 10,
} as Record<KnowledgeType, number> & { total: number };

const emptyHistory: StudyHistory = {
  runs: [],
  totals: { runCount: 0, avgScorePercent: 0 },
  markedCount: 2,
};

describe("ProgressSection", () => {
  it("shows the empty-runs line and the marked count when there is no history", () => {
    render(<ProgressSection libraryStats={libraryStats} history={emptyHistory} />);
    expect(screen.getByText("progress.noRuns")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // markedCount headline
  });

  it("lists recent runs with score and totals", () => {
    const history: StudyHistory = {
      runs: [
        {
          id: "r1",
          kind: "practice",
          mode: "vocabulary",
          scope: "level",
          level: "A2",
          questionCount: 10,
          correctCount: 8,
          scorePercent: 80,
          startedAt: "2026-09-02T10:00:00.000Z",
          completedAt: "2026-09-02T10:05:00.000Z",
        },
        {
          id: "r2",
          kind: "exam",
          mode: null,
          scope: "all",
          level: null,
          questionCount: 20,
          correctCount: 11,
          scorePercent: 55,
          startedAt: "2026-09-01T10:00:00.000Z",
          completedAt: "2026-09-01T10:20:00.000Z",
        },
      ],
      totals: { runCount: 2, avgScorePercent: 68 },
      markedCount: 0,
    };
    render(<ProgressSection libraryStats={libraryStats} history={history} />);
    expect(screen.getByText("progress.runKind.practice")).toBeInTheDocument();
    expect(screen.getByText("progress.runKind.exam")).toBeInTheDocument();
    // one score line per run
    expect(screen.getAllByText(/progress\.runScore:/)).toHaveLength(2);
    expect(screen.getByText("68")).toBeInTheDocument(); // avg score headline
  });
});
