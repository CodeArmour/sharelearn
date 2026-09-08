import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/server/actions/ai", () => ({
  structureKnowledgeAction: vi.fn(),
  extractFromPhotosAction: vi.fn(),
}));
vi.mock("@/server/actions/knowledge", () => ({
  createKnowledgeItemAction: vi.fn(),
  createKnowledgeItemsAction: vi.fn(),
  updateKnowledgeItemAction: vi.fn(),
}));
vi.mock("./downscale-image", () => ({
  downscaleImage: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" })),
  ImageDecodeError: class ImageDecodeError extends Error {},
}));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "u1/x.jpg" }, error: null }),
      }),
    },
  }),
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

import { extractFromPhotosAction, structureKnowledgeAction } from "@/server/actions/ai";
import { createKnowledgeItemsAction } from "@/server/actions/knowledge";

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

  it("shows the photo mode toggle when aiEnabled and userId are set", () => {
    render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
    expect(screen.getByRole("button", { name: "add.ai.mode.photos" })).toBeInTheDocument();
  });

  it("renders the review checklist after a successful photo extraction", async () => {
    vi.mocked(extractFromPhotosAction).mockResolvedValue({
      ok: true,
      data: {
        truncated: false,
        items: [
          { type: "vocabulary", fields: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun" } },
          { type: "note", fields: { title: "", noteBody: "ask about er" } },
        ],
      },
    });

    render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "add.ai.mode.photos" }));
    await userEvent.upload(
      screen.getByLabelText("add.ai.photos.pick"),
      new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add\.ai\.review\.submit/ })).toBeInTheDocument();
    });
  });

  it("bulk-saves the checked rows and shows the success panel", async () => {
    vi.mocked(extractFromPhotosAction).mockResolvedValue({
      ok: true,
      data: { truncated: false, items: [{ type: "note", fields: { title: "", noteBody: "n1" } }] },
    });
    vi.mocked(createKnowledgeItemsAction).mockResolvedValue({ ok: true, data: { ids: ["a"] } });

    render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "add.ai.mode.photos" }));
    await userEvent.upload(
      screen.getByLabelText("add.ai.photos.pick"),
      new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

    const save = await screen.findByRole("button", { name: /add\.ai\.review\.submit/ });
    fireEvent.click(save);

    await waitFor(() => expect(createKnowledgeItemsAction).toHaveBeenCalled());
  });
});
