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
