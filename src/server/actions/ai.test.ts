// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  structureKnowledge,
  extractKnowledgeFromFiles,
  resolveActiveContext,
  createServerSupabaseClient,
  findDuplicateKeys,
} = vi.hoisted(() => ({
  structureKnowledge: vi.fn(),
  extractKnowledgeFromFiles: vi.fn(),
  resolveActiveContext: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  findDuplicateKeys: vi.fn(),
}));

vi.mock("@/ai/services/knowledge-processor", () => ({ structureKnowledge }));
vi.mock("@/ai/services/knowledge-extractor", () => ({ extractKnowledgeFromFiles }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext }));
vi.mock("@/server/auth/supabase", () => ({ createServerSupabaseClient }));
vi.mock("@/server/services/knowledge-service", () => ({
  findDuplicateKeys,
  duplicateKeyFromSuggestion: (s: { type: string; fields: Record<string, string> }) =>
    s.type === "vocabulary"
      ? { type: "vocabulary", value: s.fields.term ?? "" }
      : s.type === "grammar" || s.type === "reading"
        ? { type: s.type, value: s.fields.title ?? "" }
        : null,
}));

import { extractFromFilesAction, structureKnowledgeAction } from "./ai";

beforeEach(() => {
  structureKnowledge.mockReset();
  resolveActiveContext.mockReset();
  resolveActiveContext.mockResolvedValue({
    status: "ok",
    user: { id: "u1", name: "U", avatar: null, avatarUrl: null },
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

describe("extractFromFilesAction", () => {
  const goodPaths = ["11111111-1111-1111-1111-111111111111/a.jpg"];

  beforeEach(() => {
    extractKnowledgeFromFiles.mockReset();
    createServerSupabaseClient.mockReset();
    findDuplicateKeys.mockReset();
    findDuplicateKeys.mockResolvedValue(new Map());
    resolveActiveContext.mockResolvedValue({
      status: "ok",
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        name: "U",
        avatar: null,
        avatarUrl: null,
      },
      activeGroup: { id: "g1", name: "G", slug: "g" },
      membership: { groupId: "g1", userId: "11111111-1111-1111-1111-111111111111", role: "member" },
    });
  });

  it("rejects zero paths and more than three", async () => {
    expect(await extractFromFilesAction([])).toMatchObject({ ok: false, code: "validation" });
    expect(
      await extractFromFilesAction([
        "11111111-1111-1111-1111-111111111111/a.jpg",
        "11111111-1111-1111-1111-111111111111/b.jpg",
        "11111111-1111-1111-1111-111111111111/c.jpg",
        "11111111-1111-1111-1111-111111111111/d.jpg",
      ]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects an unsupported file path", async () => {
    expect(
      await extractFromFilesAction(["11111111-1111-1111-1111-111111111111/a.png"]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a path outside the caller's own prefix", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    const r = await extractFromFilesAction(["22222222-2222-2222-2222-222222222222/a.jpg"]);
    expect(r).toMatchObject({ ok: false, code: "validation" });
    expect(extractKnowledgeFromFiles).not.toHaveBeenCalled();
  });

  it("returns items on ok and deletes the staged objects", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromFiles.mockResolvedValue({
      status: "ok",
      items: [{ type: "note", fields: { title: "", noteBody: "n" } }],
      truncated: false,
    });

    const r = await extractFromFilesAction(goodPaths);

    expect(r).toEqual({
      ok: true,
      data: {
        items: [{ type: "note", fields: { title: "", noteBody: "n" } }],
        truncated: false,
        duplicates: [],
      },
    });
    expect(s.createSignedUrl).toHaveBeenCalledWith(goodPaths[0], 300);
    expect(extractKnowledgeFromFiles).toHaveBeenCalledWith([
      { kind: "image", url: "https://signed/x" },
    ]);
    expect(s.remove).toHaveBeenCalledWith(goodPaths);
  });

  it("passes a staged spreadsheet to the extractor as a file", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromFiles.mockResolvedValue({
      status: "ok",
      items: [{ type: "note", fields: { title: "", noteBody: "n" } }],
      truncated: false,
    });
    const paths = ["11111111-1111-1111-1111-111111111111/worksheet.xlsx"];

    await extractFromFilesAction(paths);

    expect(extractKnowledgeFromFiles).toHaveBeenCalledWith([
      { kind: "file", url: "https://signed/x", filename: "worksheet.xlsx" },
    ]);
    expect(s.remove).toHaveBeenCalledWith(paths);
  });

  it("reports which extracted items are already in the library", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromFiles.mockResolvedValue({
      status: "ok",
      truncated: false,
      items: [
        {
          type: "vocabulary",
          fields: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun" },
        },
        { type: "note", fields: { title: "", noteBody: "n" } },
        {
          type: "vocabulary",
          fields: { term: "het huis", meaning: "the house", partOfSpeech: "noun" },
        },
      ],
    });
    findDuplicateKeys.mockResolvedValue(new Map([[2, { existingId: "k9", label: "het huis" }]]));

    const r = await extractFromFilesAction(goodPaths);

    expect(r).toMatchObject({ ok: true, data: { duplicates: [2] } });
    expect(findDuplicateKeys).toHaveBeenCalledWith(
      [{ type: "vocabulary", value: "de fiets" }, null, { type: "vocabulary", value: "het huis" }],
      "g1",
    );
  });

  it("deletes the staged objects even when extraction errors", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromFiles.mockResolvedValue({ status: "error" });

    const r = await extractFromFilesAction(goodPaths);

    expect(r).toMatchObject({ ok: false, code: "ai-error" });
    expect(s.remove).toHaveBeenCalledWith(goodPaths);
  });

  it("maps unavailable → ai-unavailable", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromFiles.mockResolvedValue({ status: "unavailable" });
    expect(await extractFromFilesAction(goodPaths)).toMatchObject({
      ok: false,
      code: "ai-unavailable",
    });
  });

  it("rejects when there is no active context", async () => {
    resolveActiveContext.mockResolvedValue({ status: "needs-login" });
    expect(await extractFromFilesAction(goodPaths)).toMatchObject({
      ok: false,
      code: "unauthorized",
    });
  });
});
