import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${ns}.${key}:${JSON.stringify(vals)}` : ns ? `${ns}.${key}` : key,
}));

import type { PracticeQuestion } from "@/types";

import { ExamSession } from "./exam-session";

const q = (id: string, prompt: string): PracticeQuestion => ({
  id,
  knowledgeId: id,
  knowledgeType: "vocabulary",
  instructionKey: "meaningOf",
  prompt,
  options: ["a", "b", "c"],
  correctIndex: 0,
});

const START = 1_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

function renderSession(over: Partial<Parameters<typeof ExamSession>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <ExamSession
      questions={[q("q1", "First"), q("q2", "Second"), q("q3", "Third")]}
      onSubmit={onSubmit}
      startedAtMs={START}
      length={10}
      {...over}
    />,
  );
  return onSubmit;
}

describe("ExamSession", () => {
  it("shows one question at a time and moves with Next / Previous", () => {
    renderSession();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "exam.session.prev" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.next" }));
    expect(screen.getByText("Second")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.next" }));
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "exam.session.next" })).toBeDisabled();
  });

  it("jumps via the navigator and records answers", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "a" })); // answer q1
    fireEvent.click(screen.getByRole("button", { name: "3" })); // navigator → q3
    expect(screen.getByText("Third")).toBeInTheDocument();
    // navigator cell 1 now shows answered (aria-current is on 3)
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-primary");
  });

  it("pins the current question", () => {
    renderSession();
    const pin = screen.getByRole("button", { name: "exam.session.pin" });
    fireEvent.click(pin);
    expect(screen.getByRole("button", { name: "exam.session.unpin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("asks to confirm hand-in when questions are unanswered", () => {
    const onSubmit = renderSession();
    fireEvent.click(screen.getAllByRole("button", { name: "exam.session.handIn" })[0]);
    expect(screen.getByText(/exam\.session\.handInConfirm\.title/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.handInConfirm.cancel" }));
    expect(screen.queryByText(/exam\.session\.handInConfirm\.title/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "exam.session.handIn" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "exam.session.handInConfirm.confirm" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([null, null, null]);
  });

  it("hands in straight away when everything is answered and nothing is flagged", () => {
    const onSubmit = renderSession({ questions: [q("q1", "Only")] });
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getAllByRole("button", { name: "exam.session.handIn" })[0]);
    expect(onSubmit).toHaveBeenCalledWith([0]);
  });

  it("locks and auto-submits when time runs out", () => {
    const onSubmit = renderSession({ length: 10 }); // 30 min budget
    act(() => {
      vi.setSystemTime(START + 30 * 60_000 + 1000);
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/exam\.session\.timeUp\.title/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "a" })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000); // auto-submit timeout
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("never submits twice", () => {
    const onSubmit = renderSession({ length: 10 });
    act(() => {
      vi.setSystemTime(START + 30 * 60_000 + 1000);
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole("button", { name: "exam.session.timeUp.viewResults" }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
