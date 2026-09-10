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
vi.mock("@/server/actions/practice", () => ({
  generateReadingQuizAction: vi.fn().mockResolvedValue({ ok: true }),
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
import {
  createKnowledgeItemAction,
  createKnowledgeItemsAction,
  updateKnowledgeItemAction,
} from "@/server/actions/knowledge";
import { generateReadingQuizAction } from "@/server/actions/practice";

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
        duplicates: [],
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
      data: {
        truncated: false,
        duplicates: [],
        items: [{ type: "note", fields: { title: "", noteBody: "n1" } }],
      },
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

  it("fires reading-quiz generation after a reading is created", async () => {
    vi.mocked(createKnowledgeItemAction).mockResolvedValue({
      ok: true,
      data: { id: "r-123", type: "reading", title: "Op de markt", body: "..." } as never,
    });

    render(<AddKnowledgeView aiEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "knowledge.type.reading" }));
    // The required fields render their label with a trailing " *", so match loosely.
    fireEvent.change(screen.getByLabelText(/add\.field\.title/), {
      target: { value: "Op de markt" },
    });
    fireEvent.change(screen.getByLabelText(/add\.field\.readingBody/), {
      target: { value: "Een tekst over de markt op zaterdag." },
    });
    fireEvent.click(screen.getByRole("button", { name: "add.submit" }));

    await waitFor(() => expect(generateReadingQuizAction).toHaveBeenCalledWith("r-123"));
  });

  it("fires reading-quiz generation after an existing reading is edited", async () => {
    vi.mocked(updateKnowledgeItemAction).mockResolvedValue({
      ok: true,
      data: { id: "r-9", type: "reading", title: "Op de markt", body: "..." } as never,
    });

    const existing = {
      id: "r-9",
      type: "reading",
      level: null,
      tags: [],
      source: "manual",
      addedBy: { id: "u1", name: "U", initials: "UU", accent: "blue", avatarUrl: null },
      updatedBy: null,
      createdAt: "2026-09-04T08:00:00.000Z",
      updatedAt: "2026-09-04T08:00:00.000Z",
      title: "Op de markt",
      body: "Een tekst over de markt op zaterdag.",
      wordCount: 7,
      summary: null,
      vocabularyIds: [],
      readingQuiz: null,
    } as never;

    render(<AddKnowledgeView existingItem={existing} />);
    fireEvent.click(screen.getByRole("button", { name: "add.saveChanges" }));

    await waitFor(() => expect(generateReadingQuizAction).toHaveBeenCalledWith("r-9"));
  });

  it("fires reading-quiz generation once per id after a batch save", async () => {
    vi.mocked(extractFromPhotosAction).mockResolvedValue({
      ok: true,
      data: {
        truncated: false,
        duplicates: [],
        items: [
          { type: "note", fields: { title: "", noteBody: "n1" } },
          { type: "note", fields: { title: "", noteBody: "n2" } },
        ],
      },
    });
    vi.mocked(createKnowledgeItemsAction).mockResolvedValue({ ok: true, data: { ids: ["a", "b"] } });

    render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: "add.ai.mode.photos" }));
    await userEvent.upload(
      screen.getByLabelText("add.ai.photos.pick"),
      new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

    const save = await screen.findByRole("button", { name: /add\.ai\.review\.submit/ });
    fireEvent.click(save);

    await waitFor(() => {
      expect(generateReadingQuizAction).toHaveBeenCalledWith("a");
      expect(generateReadingQuizAction).toHaveBeenCalledWith("b");
    });
  });

  it("prompts before adding a duplicate, then adds it on confirm", async () => {
    vi.mocked(structureKnowledgeAction).mockResolvedValue({
      ok: true,
      data: {
        type: "vocabulary",
        fields: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun" },
      },
    });
    vi.mocked(createKnowledgeItemAction)
      .mockResolvedValueOnce({
        ok: false,
        code: "duplicate",
        message: "dup",
        existingId: "k9",
        label: "de fiets",
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "new1", type: "note", body: "de fiets" } as never,
      });

    render(<AddKnowledgeView aiEnabled />);
    fireEvent.change(screen.getByLabelText("add.ai.captureLabel"), {
      target: { value: "de fiets — the bike" },
    });
    fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

    const confirm = await screen.findByRole("button", { name: "add.ai.confirm" });
    fireEvent.click(confirm);

    await screen.findByText("add.duplicate.prompt");
    expect(createKnowledgeItemAction).toHaveBeenCalledTimes(1);
    expect(createKnowledgeItemAction).toHaveBeenLastCalledWith(expect.anything(), {
      allowDuplicate: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "add.duplicate.addAnyway" }));

    await waitFor(() => expect(createKnowledgeItemAction).toHaveBeenCalledTimes(2));
    expect(createKnowledgeItemAction).toHaveBeenLastCalledWith(expect.anything(), {
      allowDuplicate: true,
    });
  });
});
