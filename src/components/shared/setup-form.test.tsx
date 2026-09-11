import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import type { PracticeSetup } from "@/types";

import { SetupForm } from "./setup-form";

const setup: PracticeSetup = { mode: "mixed", scope: "all", length: 10 };

function renderForm(onChange = vi.fn()) {
  render(
    <SetupForm
      setup={setup}
      levels={[]}
      count={5}
      startLabel="Start"
      onChange={onChange}
      onStart={vi.fn()}
    />,
  );
  return onChange;
}

describe("SetupForm reading mode", () => {
  it("renders a Reading mode button", () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: "practice.setup.mode.reading" }),
    ).toBeInTheDocument();
  });

  it("selects reading mode on click", () => {
    const onChange = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "practice.setup.mode.reading" }));
    expect(onChange).toHaveBeenCalledWith({ mode: "reading" });
  });
});

describe("SetupForm exam variant", () => {
  const examSetup: PracticeSetup = { mode: "mixed", scope: "level", level: "B1", length: 20 };

  it("hides the mode buttons", () => {
    render(
      <SetupForm
        setup={examSetup}
        levels={["A1", "B1"]}
        count={10}
        startLabel="Start exam"
        variant="exam"
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "practice.setup.mode.mixed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "practice.setup.mode.reading" })).not.toBeInTheDocument();
  });

  it("offers only the by-level scope option", () => {
    render(
      <SetupForm
        setup={examSetup}
        levels={["A1", "B1"]}
        count={10}
        startLabel="Start exam"
        variant="exam"
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    const scope = screen.getByLabelText("practice.setup.scopeLabel") as HTMLSelectElement;
    const values = Array.from(scope.options).map((o) => o.value);
    expect(values).toEqual(["level"]);
  });

  it("still shows the length group", () => {
    render(
      <SetupForm
        setup={examSetup}
        levels={["A1", "B1"]}
        count={10}
        startLabel="Start exam"
        variant="exam"
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "practice.setup.lengthLabel" })).toBeInTheDocument();
  });
});
