import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import type { PracticeQuestion } from "@/types";

import { PracticeSession } from "./practice-session";

const passageA = { id: "r1", title: "Op de markt", body: "Een tekst over de markt." };
const passageB = { id: "r2", title: "In het park", body: "Een tekst over het park." };

const rq = (over: Partial<PracticeQuestion>): PracticeQuestion => ({
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

const vocab = (over: Partial<PracticeQuestion>): PracticeQuestion => ({
  id: "v",
  knowledgeId: "k",
  knowledgeType: "vocabulary",
  instructionKey: "meaningOf",
  prompt: "huis",
  options: ["house", "tree", "car"],
  correctIndex: 0,
  ...over,
});

describe("PracticeSession — reading blocks", () => {
  it("shows a passage and all of its questions together on one screen", () => {
    render(
      <PracticeSession
        questions={[
          rq({ id: "q_r1_q1", prompt: "Eerste vraag" }),
          rq({ id: "q_r1_q2", prompt: "Tweede vraag", instructionKey: "trueOrFalse", options: ["Waar", "Onwaar"] }),
          rq({ id: "q_r1_q3", prompt: "Derde vraag" }),
        ]}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("Op de markt")).toBeInTheDocument();
    expect(screen.getByText("Eerste vraag")).toBeInTheDocument();
    expect(screen.getByText("Tweede vraag")).toBeInTheDocument();
    expect(screen.getByText("Derde vraag")).toBeInTheDocument();
  });

  it("only reveals the Next button once every question in the block is answered", () => {
    render(
      <PracticeSession
        questions={[
          rq({ id: "q_r1_q1", prompt: "Eerste vraag" }),
          rq({ id: "q_r1_q2", prompt: "Tweede vraag" }),
        ]}
        onComplete={vi.fn()}
      />,
    );

    // answer the first question of the block
    fireEvent.click(screen.getAllByRole("button", { name: "a" })[0]);
    expect(screen.queryByRole("button", { name: "practice.session.finish" })).not.toBeInTheDocument();

    // answer the second — now the block is done
    fireEvent.click(screen.getAllByRole("button", { name: "a" })[1]);
    expect(screen.getByRole("button", { name: "practice.session.finish" })).toBeInTheDocument();
  });

  it("locks a question and shows feedback as soon as it is answered", () => {
    render(
      <PracticeSession
        questions={[rq({ id: "q_r1_q1" }), rq({ id: "q_r1_q2" })]}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "b" })[0]); // wrong pick (correct is "a")
    expect(screen.getByText("practice.feedback.incorrect")).toBeInTheDocument();
    // the answered question's options are now disabled
    expect(screen.getAllByRole("button", { name: "a" })[0]).toBeDisabled();
    // the second question is still open
    expect(screen.getAllByRole("button", { name: "a" })[1]).not.toBeDisabled();
  });

  it("walks from one passage block to the next", () => {
    render(
      <PracticeSession
        questions={[
          rq({ id: "q_r1_q1" }),
          rq({ id: "q_r2_q1", knowledgeId: "r2", passage: passageB }),
        ]}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("Op de markt")).toBeInTheDocument();
    expect(screen.queryByText("In het park")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "practice.session.next" }));

    expect(screen.queryByText("Op de markt")).not.toBeInTheDocument();
    expect(screen.getByText("In het park")).toBeInTheDocument();
  });

  it("keeps vocab/grammar one question per screen and reports answers in original order", () => {
    const onComplete = vi.fn();
    render(
      <PracticeSession
        questions={[
          rq({ id: "q_r1_q1" }), // block: 1 question
          vocab({ id: "v1", prompt: "huis" }),
        ]}
        onComplete={onComplete}
      />,
    );

    // block screen: only the reading question, no vocab prompt yet
    expect(screen.getByText("Vraag?")).toBeInTheDocument();
    expect(screen.queryByText("huis")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "practice.session.next" }));

    // now the standalone vocab question, no passage
    expect(screen.getByText("huis")).toBeInTheDocument();
    expect(screen.queryByText("Op de markt")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "tree" })); // wrong (correct is "house"/0)
    fireEvent.click(screen.getByRole("button", { name: "practice.session.finish" }));

    expect(onComplete).toHaveBeenCalledWith([0, 1]);
  });

  it("progress counter is question-based across the whole run", () => {
    render(
      <PracticeSession
        questions={[rq({ id: "q_r1_q1" }), rq({ id: "q_r1_q2" }), vocab({ id: "v1" })]}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("practice.session.progress")).toBeInTheDocument();
  });
});
