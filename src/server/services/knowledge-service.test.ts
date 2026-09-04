// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/knowledge", () => ({
  insertKnowledgeItem: vi.fn(),
  listKnowledgeItems: vi.fn(),
  getKnowledgeItemById: vi.fn(),
  getKnowledgeStats: vi.fn(),
  getDistinctLevels: vi.fn(),
}));
vi.mock("@/server/repositories/memberships", () => ({ listMembers: vi.fn() }));
vi.mock("@/server/db/client", () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { NotFoundError } from "@/server/errors";
import { listMembers } from "@/server/repositories/memberships";
import * as repo from "@/server/repositories/knowledge";
import { resolveActiveContext } from "@/server/services/session-service";

import {
  createKnowledgeItem,
  getKnowledgeById,
  getKnowledgeByIds,
  getLibraryFacets,
  getLibraryItems,
  getLibraryStats,
  getTodayFeed,
} from "./knowledge-service";

const user = { id: "u1", name: "U", initials: "UU", avatarUrl: null };
const okCtx = {
  status: "ok" as const,
  user,
  activeGroup: { id: "g1", name: "G", slug: "g" },
  membership: { groupId: "g1", userId: "u1", role: "member" as const },
};

const vocab = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "k1",
  type: "vocabulary" as const,
  level: "A2" as const,
  tags: [],
  source: "manual" as const,
  addedBy: user,
  updatedBy: null,
  createdAt: "2026-09-04T08:00:00.000Z",
  updatedAt: "2026-09-04T08:00:00.000Z",
  term: "gezellig",
  meaning: "cozy",
  partOfSpeech: "Bijvoeglijk naamwoord",
  example: null,
  exampleTranslation: null,
  article: null,
  plural: null,
  pastTense: null,
  perfect: null,
  usageNote: null,
  ...over,
});

beforeEach(() => {
  vi.mocked(resolveActiveContext).mockResolvedValue(okCtx);
});

describe("createKnowledgeItem", () => {
  it("throws when there is no active group", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue({ status: "needs-group" });
    await expect(
      createKnowledgeItem({
        type: "note",
        level: null,
        tags: [],
        source: "manual",
        title: null,
        body: "x",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("inserts scoped to the active group and actor", async () => {
    vi.mocked(repo.insertKnowledgeItem).mockResolvedValue(vocab());
    const result = await createKnowledgeItem({
      type: "vocabulary",
      level: "A2",
      tags: [],
      source: "manual",
      term: "gezellig",
      meaning: "cozy",
      partOfSpeech: "Bijvoeglijk naamwoord",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    expect(result.type).toBe("vocabulary");
    expect(repo.insertKnowledgeItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ groupId: "g1", addedBy: "u1", type: "vocabulary" }),
    );
  });

  it("computes word_count for a reading item", async () => {
    vi.mocked(repo.insertKnowledgeItem).mockResolvedValue(vocab({ type: "reading" }));
    await createKnowledgeItem({
      type: "reading",
      level: null,
      tags: [],
      source: "manual",
      title: "Een dagje Antwerpen",
      body: "We gingen af en toe naar Antwerpen.",
      summary: null,
    });
    expect(repo.insertKnowledgeItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ wordCount: 7, vocabularyIds: [] }),
    );
  });
});

describe("getLibraryItems", () => {
  it("sorts az and paginates", async () => {
    vi.mocked(repo.listKnowledgeItems).mockResolvedValue([
      vocab({ id: "b", term: "banaan" }),
      vocab({ id: "a", term: "appel" }),
    ]);
    const result = await getLibraryItems({ sort: "az" });
    expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.total).toBe(2);
  });
});

describe("getKnowledgeByIds", () => {
  it("preserves input order and drops unknown ids", async () => {
    vi.mocked(repo.listKnowledgeItems).mockResolvedValue([
      vocab({ id: "a" }),
      vocab({ id: "b" }),
    ]);
    const result = await getKnowledgeByIds(["b", "missing", "a"]);
    expect(result.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("getLibraryFacets", () => {
  it("combines distinct levels with real members", async () => {
    vi.mocked(repo.getDistinctLevels).mockResolvedValue(["A2", "B1"]);
    vi.mocked(listMembers).mockResolvedValue([]);
    const facets = await getLibraryFacets();
    expect(facets.levels).toEqual(["A2", "B1"]);
  });
});

describe("getLibraryStats", () => {
  it("fills zero counts for absent types", async () => {
    vi.mocked(repo.getKnowledgeStats).mockResolvedValue([{ type: "note", count: 3 }]);
    const stats = await getLibraryStats();
    expect(stats).toEqual({ vocabulary: 0, grammar: 0, reading: 0, file: 0, note: 3, total: 3 });
  });
});

describe("getTodayFeed", () => {
  it("groups today's items by kind", async () => {
    const now = new Date().toISOString();
    vi.mocked(repo.listKnowledgeItems).mockResolvedValue([vocab({ createdAt: now })]);
    const feed = await getTodayFeed();
    expect(feed.vocabulary).toHaveLength(1);
    expect(feed.practice.itemCount).toBe(1);
  });
});

describe("getKnowledgeById", () => {
  it("returns null when the id belongs to another group", async () => {
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(null);
    expect(await getKnowledgeById("nope")).toBeNull();
  });
});
