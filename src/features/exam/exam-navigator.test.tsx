import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import { ExamNavigator } from "./exam-navigator";

describe("ExamNavigator", () => {
  const base = {
    count: 4,
    current: 1,
    answered: [true, false, false, true],
    pinned: [false, false, true, false],
    onJump: vi.fn(),
  };

  it("renders one button per question", () => {
    render(<ExamNavigator {...base} onJump={vi.fn()} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
  });

  it("marks the current question with aria-current", () => {
    render(<ExamNavigator {...base} onJump={vi.fn()} />);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute("aria-current");
  });

  it("jumps on click", () => {
    const onJump = vi.fn();
    render(<ExamNavigator {...base} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("shows a flag on pinned questions only", () => {
    render(<ExamNavigator {...base} onJump={vi.fn()} />);
    // question 3 is pinned — its button contains the flag's accessible marker
    const pinnedBtn = screen.getByRole("button", { name: "3" });
    expect(pinnedBtn.querySelector("svg")).not.toBeNull();
    const plainBtn = screen.getByRole("button", { name: "1" });
    expect(plainBtn.querySelector("svg")).toBeNull();
  });
});
