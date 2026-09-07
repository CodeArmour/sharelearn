import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/server/actions/ai", () => ({ structureKnowledgeAction: vi.fn() }));
vi.mock("@/server/actions/knowledge", () => ({
  createKnowledgeItemAction: vi.fn(),
  updateKnowledgeItemAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
// Namespace-aware so the AI capture box's `useTranslations("add.ai")` label
// resolves to a stable, greppable string for the gate assertions below.
vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import { structureKnowledgeAction } from "@/server/actions/ai";

import { AddKnowledgeView } from "./add-knowledge-view";

describe("AddKnowledgeView", () => {
  it("hides the AI capture box when aiEnabled is false", () => {
    render(<AddKnowledgeView aiEnabled={false} />);
    expect(screen.queryByLabelText("add.ai.captureLabel")).not.toBeInTheDocument();
  });

  it("shows the AI capture box when aiEnabled is true", () => {
    render(<AddKnowledgeView aiEnabled />);
    expect(screen.getByLabelText("add.ai.captureLabel")).toBeInTheDocument();
  });

  it("drops into the failed panel when the AI action throws", async () => {
    vi.mocked(structureKnowledgeAction).mockRejectedValue(new Error("boom"));
    render(<AddKnowledgeView aiEnabled />);

    fireEvent.change(screen.getByLabelText("add.ai.captureLabel"), {
      target: { value: "de hond — the dog" },
    });
    fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

    await waitFor(() => {
      expect(screen.getByText("add.ai.failedTitle")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("add.ai.captureLabel")).not.toBeInTheDocument();
  });
});
