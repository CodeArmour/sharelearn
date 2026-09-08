// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { structureKnowledge, extractKnowledgeFromImages, resolveActiveContext, createServerSupabaseClient } =
  vi.hoisted(() => ({
    structureKnowledge: vi.fn(),
    extractKnowledgeFromImages: vi.fn(),
    resolveActiveContext: vi.fn(),
    createServerSupabaseClient: vi.fn(),
  }));

vi.mock("@/ai/services/knowledge-processor", () => ({ structureKnowledge }));
vi.mock("@/ai/services/knowledge-extractor", () => ({ extractKnowledgeFromImages }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext }));
vi.mock("@/server/auth/supabase", () => ({ createServerSupabaseClient }));

import { extractFromPhotosAction, structureKnowledgeAction } from "./ai";

beforeEach(() => {
  structureKnowledge.mockReset();
  resolveActiveContext.mockReset();
  resolveActiveContext.mockResolvedValue({
    status: "ok",
    user: { id: "u1", name: "U", initials: "UU", avatarUrl: null },
    activeGroup: { id: "g1", name: "G", slug: "g" },
    membership: { groupId: "g1", userId: "u1", role: "member" },
  });
});

describe("structureKnowledgeAction", () => {
  it("rejects invalid input without calling the service", async () => {
    const r = await structureKnowledgeAction("a");
    expect(r).toEqual({ ok: false, code: "validation", message: expect.any(String) });
    expect(structureKnowledge).not.toHaveBeenCalled();
  });

  it("rejects when there is no active context, without calling the service", async () => {
    resolveActiveContext.mockResolvedValue({ status: "needs-login" });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    expect(structureKnowledge).not.toHaveBeenCalled();
  });

  it("returns the suggestion on ok", async () => {
    structureKnowledge.mockResolvedValue({
      status: "ok",
      suggestion: { type: "note", fields: { title: "", noteBody: "hi" } },
    });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toEqual({ ok: true, data: { type: "note", fields: { title: "", noteBody: "hi" } } });
  });

  it("maps unavailable → ai-unavailable", async () => {
    structureKnowledge.mockResolvedValue({ status: "unavailable" });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toMatchObject({ ok: false, code: "ai-unavailable" });
  });

  it("maps error → ai-error", async () => {
    structureKnowledge.mockResolvedValue({ status: "error" });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toMatchObject({ ok: false, code: "ai-error" });
  });

  it("passes the trimmed text to the service", async () => {
    structureKnowledge.mockResolvedValue({ status: "error" });
    await structureKnowledgeAction("   pasted material here   ");
    expect(structureKnowledge).toHaveBeenCalledWith("pasted material here");
  });
});

function fakeStorage() {
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: "https://signed/x" }, error: null });
  const from = vi.fn(() => ({ createSignedUrl, remove }));
  return { client: { storage: { from } }, from, createSignedUrl, remove };
}

describe("extractFromPhotosAction", () => {
  const goodPaths = ["11111111-1111-1111-1111-111111111111/a.jpg"];

  beforeEach(() => {
    extractKnowledgeFromImages.mockReset();
    createServerSupabaseClient.mockReset();
    resolveActiveContext.mockResolvedValue({
      status: "ok",
      user: { id: "11111111-1111-1111-1111-111111111111", name: "U", initials: "UU", avatarUrl: null },
      activeGroup: { id: "g1", name: "G", slug: "g" },
      membership: { groupId: "g1", userId: "11111111-1111-1111-1111-111111111111", role: "member" },
    });
  });

  it("rejects zero paths and more than three", async () => {
    expect(await extractFromPhotosAction([])).toMatchObject({ ok: false, code: "validation" });
    expect(
      await extractFromPhotosAction([
        "11111111-1111-1111-1111-111111111111/a.jpg",
        "11111111-1111-1111-1111-111111111111/b.jpg",
        "11111111-1111-1111-1111-111111111111/c.jpg",
        "11111111-1111-1111-1111-111111111111/d.jpg",
      ]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a non-.jpg path", async () => {
    expect(
      await extractFromPhotosAction(["11111111-1111-1111-1111-111111111111/a.png"]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a path outside the caller's own prefix", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    const r = await extractFromPhotosAction(["22222222-2222-2222-2222-222222222222/a.jpg"]);
    expect(r).toMatchObject({ ok: false, code: "validation" });
    expect(extractKnowledgeFromImages).not.toHaveBeenCalled();
  });

  it("returns items on ok and deletes the staged objects", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromImages.mockResolvedValue({
      status: "ok",
      items: [{ type: "note", fields: { title: "", noteBody: "n" } }],
      truncated: false,
    });

    const r = await extractFromPhotosAction(goodPaths);

    expect(r).toEqual({ ok: true, data: { items: [{ type: "note", fields: { title: "", noteBody: "n" } }], truncated: false } });
    expect(s.createSignedUrl).toHaveBeenCalledWith(goodPaths[0], 300);
    expect(extractKnowledgeFromImages).toHaveBeenCalledWith([{ url: "https://signed/x" }]);
    expect(s.remove).toHaveBeenCalledWith(goodPaths);
  });

  it("deletes the staged objects even when extraction errors", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromImages.mockResolvedValue({ status: "error" });

    const r = await extractFromPhotosAction(goodPaths);

    expect(r).toMatchObject({ ok: false, code: "ai-error" });
    expect(s.remove).toHaveBeenCalledWith(goodPaths);
  });

  it("maps unavailable → ai-unavailable", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromImages.mockResolvedValue({ status: "unavailable" });
    expect(await extractFromPhotosAction(goodPaths)).toMatchObject({ ok: false, code: "ai-unavailable" });
  });

  it("rejects when there is no active context", async () => {
    resolveActiveContext.mockResolvedValue({ status: "needs-login" });
    expect(await extractFromPhotosAction(goodPaths)).toMatchObject({ ok: false, code: "unauthorized" });
  });
});
