import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import type { PracticeQuestion } from "@/types";

import { PracticeSession } from "./practice-session";

const passageA = { id: "r1", title: "Op de markt", body: "Een tekst over de markt." };

const q = (over: Partial<PracticeQuestion>): PracticeQuestion => ({
  id: "x",
  knowledgeId: "r1",
  knowledgeType: "reading",
  instructionKey: "readComprehension",
  prompt: "Vraag?",
  options: ["a", "b", "c", "d"],
  correctIndex: 0,
  passage: passageA,
  ...over,
});

describe("PracticeSession passage rendering", () => {
  it("shows the passage on the first question of a passage run and hides it on the next", () => {
    render(
      <PracticeSession
        questions={[
          q({ id: "q_r1_q1" }),
          q({ id: "q_r1_q2", instructionKey: "trueOrFalse", options: ["Waar", "Onwaar"] }),
        ]}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("Op de markt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "practice.session.next" }));

    expect(screen.queryByText("Op de markt")).not.toBeInTheDocument();
    expect(screen.getByText("practice.instruction.trueOrFalse")).toBeInTheDocument();
  });

  it("shows the passage again when the next question belongs to a different passage", () => {
    const passageB = { id: "r2", title: "In het park", body: "Een tekst over het park." };
    render(
      <PracticeSession
        questions={[q({ id: "q_r1_q1" }), q({ id: "q_r2_q1", knowledgeId: "r2", passage: passageB })]}
        onComplete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "practice.session.next" }));
    expect(screen.getByText("In het park")).toBeInTheDocument();
  });
});
