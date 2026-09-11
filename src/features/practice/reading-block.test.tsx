import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import type { PracticeQuestion } from "@/types";

import { ReadingBlock } from "./reading-block";

const passage = { id: "r1", title: "Op de markt", body: "Een tekst." };

const q = (id: string, prompt: string): PracticeQuestion => ({
  id,
  knowledgeId: "r1",
  knowledgeType: "reading",
  instructionKey: "readComprehension",
  prompt,
  options: ["a", "b", "c", "d"],
  correctIndex: 0,
  passage,
});

describe("ReadingBlock", () => {
  it("renders the passage once and every question card", () => {
    render(
      <ReadingBlock
        passage={passage}
        questions={[q("q1", "Eerste"), q("q2", "Tweede")]}
        indices={[3, 4]}
        answers={[null, null, null, null, null]}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Op de markt")).toHaveLength(1);
    expect(screen.getByText("Eerste")).toBeInTheDocument();
    expect(screen.getByText("Tweede")).toBeInTheDocument();
  });

  it("reports a pick against the question's original run index", () => {
    const onPick = vi.fn();
    render(
      <ReadingBlock
        passage={passage}
        questions={[q("q1", "Eerste"), q("q2", "Tweede")]}
        indices={[3, 4]}
        answers={[null, null, null, null, null]}
        onPick={onPick}
      />,
    );

    // second card, third option
    fireEvent.click(screen.getAllByRole("button", { name: "c" })[1]);
    expect(onPick).toHaveBeenCalledWith(4, 2);
  });

  it("shows feedback only for questions that already have an answer", () => {
    render(
      <ReadingBlock
        passage={passage}
        questions={[q("q1", "Eerste"), q("q2", "Tweede")]}
        indices={[0, 1]}
        answers={[0, null]}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText("practice.feedback.correct")).toBeInTheDocument();
    expect(screen.queryByText("practice.feedback.incorrect")).not.toBeInTheDocument();
  });
});
