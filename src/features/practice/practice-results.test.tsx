import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => `results.${k}`,
}));

import type { PracticeQuestion } from "@/types";

import { PracticeResults } from "./practice-results";

const q: PracticeQuestion = {
  id: "1",
  knowledgeId: "1",
  knowledgeType: "vocabulary",
  instructionKey: "meaningOf",
  prompt: "p",
  options: ["a", "b"],
  correctIndex: 0,
};

describe("PracticeResults save state", () => {
  it("shows the retry control on error", () => {
    render(
      <PracticeResults
        questions={[q]}
        answers={[0]}
        onAgain={() => {}}
        saveState="error"
        onRetrySave={() => {}}
      />,
    );
    expect(screen.getByText("results.saveError")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "results.retry" })).toBeInTheDocument();
  });

  it("shows the saved line when saved", () => {
    render(
      <PracticeResults
        questions={[q]}
        answers={[0]}
        onAgain={() => {}}
        saveState="saved"
        onRetrySave={() => {}}
      />,
    );
    expect(screen.getByText("results.saved")).toBeInTheDocument();
  });
});
