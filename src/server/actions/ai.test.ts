// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { structureKnowledge, resolveActiveContext } = vi.hoisted(() => ({
  structureKnowledge: vi.fn(),
  resolveActiveContext: vi.fn(),
}));

vi.mock("@/ai/services/knowledge-processor", () => ({ structureKnowledge }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext }));

import { structureKnowledgeAction } from "./ai";

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
