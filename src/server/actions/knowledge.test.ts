// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createKnowledgeItems } = vi.hoisted(() => ({ createKnowledgeItems: vi.fn() }));

vi.mock("@/server/services/knowledge-service", () => ({
  createKnowledgeItem: vi.fn(),
  createKnowledgeItems,
  deleteKnowledgeItem: vi.fn(),
  getKnowledgeByIds: vi.fn(),
  updateKnowledgeItem: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createKnowledgeItemsAction } from "./knowledge";

const noteInput = {
  type: "note" as const,
  level: null,
  tags: [] as string[],
  source: "ai-assisted" as const,
  title: null,
  body: "a note",
};

beforeEach(() => vi.resetAllMocks());

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
});
