// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createKnowledgeItem, createKnowledgeItems, findDuplicateKeys } = vi.hoisted(() => ({
  createKnowledgeItem: vi.fn(),
  createKnowledgeItems: vi.fn(),
  findDuplicateKeys: vi.fn(),
}));

vi.mock("@/server/services/knowledge-service", () => ({
  createKnowledgeItem,
  createKnowledgeItems,
  deleteKnowledgeItem: vi.fn(),
  findDuplicateKeys,
  duplicateKeyFromInput: (input: { type: string; term?: string; title?: string }) =>
    input.type === "vocabulary"
      ? { type: "vocabulary", value: input.term }
      : input.type === "grammar" || input.type === "reading"
        ? { type: input.type, value: input.title }
        : null,
  getKnowledgeByIds: vi.fn(),
  updateKnowledgeItem: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createKnowledgeItemAction, createKnowledgeItemsAction } from "./knowledge";

const noteInput = {
  type: "note" as const,
  level: null,
  tags: [] as string[],
  source: "ai-assisted" as const,
  title: null,
  body: "a note",
};

const vocabInput = {
  type: "vocabulary" as const,
  level: null,
  tags: [] as string[],
  source: "manual" as const,
  term: "de fiets",
  meaning: "the bike",
  partOfSpeech: "noun",
  example: null,
  exampleTranslation: null,
  article: null,
  plural: null,
  pastTense: null,
  perfect: null,
  usageNote: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  findDuplicateKeys.mockResolvedValue(new Map());
});

describe("createKnowledgeItemsAction", () => {
  it("rejects an empty array", async () => {
    expect(await createKnowledgeItemsAction([])).toMatchObject({ ok: false, code: "validation" });
    expect(createKnowledgeItems).not.toHaveBeenCalled();
  });

  it("rejects more than 30 items", async () => {
    const many = Array.from({ length: 31 }, () => noteInput);
    expect(await createKnowledgeItemsAction(many)).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a malformed row", async () => {
    expect(
      await createKnowledgeItemsAction([{ type: "note", body: "" }]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("returns the created ids on success", async () => {
    createKnowledgeItems.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const r = await createKnowledgeItemsAction([noteInput, noteInput]);
    expect(r).toEqual({ ok: true, data: { ids: ["a", "b"] } });
  });

  it("maps a thrown service error to a non-ok result with a string code", async () => {
    createKnowledgeItems.mockRejectedValue(new Error("db boom"));
    const r = await createKnowledgeItemsAction([noteInput]);
    expect(r.ok).toBe(false);
    expect(typeof (r as { code: string }).code).toBe("string");
  });

  it("does not run the duplicate check for the batch path", async () => {
    createKnowledgeItems.mockResolvedValue([{ id: "a" }]);
    await createKnowledgeItemsAction([vocabInput]);
    expect(findDuplicateKeys).not.toHaveBeenCalled();
  });
});

describe("createKnowledgeItemAction", () => {
  it("rejects a malformed input without calling the service", async () => {
    const r = await createKnowledgeItemAction({ type: "vocabulary", term: "x" });
    expect(r).toMatchObject({ ok: false, code: "validation" });
    expect(createKnowledgeItem).not.toHaveBeenCalled();
  });

  it("creates the item when nothing matches", async () => {
    createKnowledgeItem.mockResolvedValue({ id: "k1", ...vocabInput });
    const r = await createKnowledgeItemAction(vocabInput);
    expect(r).toMatchObject({ ok: true });
    expect(createKnowledgeItem).toHaveBeenCalledOnce();
  });

  it("returns a duplicate result and does not insert when a match exists", async () => {
    findDuplicateKeys.mockResolvedValue(new Map([[0, { existingId: "k9", label: "de fiets" }]]));
    const r = await createKnowledgeItemAction(vocabInput);
    expect(r).toMatchObject({
      ok: false,
      code: "duplicate",
      existingId: "k9",
      label: "de fiets",
    });
    expect(createKnowledgeItem).not.toHaveBeenCalled();
  });

  it("skips the duplicate check and inserts when allowDuplicate is set", async () => {
    findDuplicateKeys.mockResolvedValue(new Map([[0, { existingId: "k9", label: "de fiets" }]]));
    createKnowledgeItem.mockResolvedValue({ id: "k2", ...vocabInput });
    const r = await createKnowledgeItemAction(vocabInput, { allowDuplicate: true });
    expect(r).toMatchObject({ ok: true });
    expect(findDuplicateKeys).not.toHaveBeenCalled();
    expect(createKnowledgeItem).toHaveBeenCalledOnce();
  });
});
