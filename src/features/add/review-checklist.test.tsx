import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/en.json";

import { ReviewChecklist, type ReviewRow } from "./review-checklist";

const rows: ReviewRow[] = [
  { id: "1", checked: true, type: "vocabulary", values: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun", article: "de" }, examples: [] },
  { id: "2", checked: false, type: "grammar", values: { title: "V2", summary: "", explanation: "verb second" }, examples: [] },
  { id: "3", checked: true, type: "note", values: { noteBody: "ask about er" }, examples: [] },
];

function setup(over: Partial<Parameters<typeof ReviewChecklist>[0]> = {}) {
  const props = {
    truncated: false,
    rows,
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onSubmit: vi.fn(),
    submitting: false,
    ...over,
  };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewChecklist {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

describe("ReviewChecklist", () => {
  it("renders one row per item with a per-type preview", () => {
    setup();
    expect(screen.getByText("de fiets — the bike")).toBeInTheDocument();
    expect(screen.getByText("V2")).toBeInTheDocument();
    expect(screen.getByText("ask about er")).toBeInTheDocument();
  });

  it("marks a row missing a required field as needing details and disables its checkbox", () => {
    setup();
    expect(screen.getByText("Needs details")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    // row 2 (grammar, no summary) is the one disabled
    expect(checkboxes.some((c) => (c as HTMLInputElement).disabled)).toBe(true);
  });

  it("counts only checked rows in the submit label", () => {
    setup();
    expect(screen.getByRole("button", { name: "Add 2 selected" })).toBeInTheDocument();
  });

  it("disables submit when nothing is checked", () => {
    setup({ rows: rows.map((r) => ({ ...r, checked: false })) });
    expect(screen.getByRole("button", { name: /Add 0 selected/ })).toBeDisabled();
  });

  it("fires onSubmit", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add 2 selected" }));
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it("shows the truncation notice when truncated", () => {
    setup({ truncated: true });
    expect(
      screen.getByText("Some items may be missing — upload a smaller section for the rest."),
    ).toBeInTheDocument();
  });

  it("tags a row that is already in the library", () => {
    setup({
      rows: [
        { id: "1", checked: false, duplicate: true, type: "vocabulary", values: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun" }, examples: [] },
        rows[2],
      ],
    });
    expect(screen.getByText("Already in library")).toBeInTheDocument();
  });
});
