// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/knowledge", () => ({
  insertKnowledgeItem: vi.fn(),
  listKnowledgeItems: vi.fn(),
  getKnowledgeItemById: vi.fn(),
  getKnowledgeStats: vi.fn(),
  getDistinctLevels: vi.fn(),
  updateKnowledgeItem: vi.fn(),
  softDeleteKnowledgeItem: vi.fn(),
  findKnowledgeByNormalizedKey: vi.fn(),
}));
vi.mock("@/server/repositories/memberships", () => ({ listMembers: vi.fn() }));
vi.mock("@/server/db/client", () => ({
  db: { transaction: (cb: (tx: unknown) => unknown) => cb({}) },
}));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { listMembers } from "@/server/repositories/memberships";
import * as repo from "@/server/repositories/knowledge";
import { resolveActiveContext } from "@/server/services/session-service";

import {
  createKnowledgeItem,
  createKnowledgeItems,
  deleteKnowledgeItem,
  duplicateKeyFromInput,
  duplicateKeyFromSuggestion,
  findDuplicateKeys,
  getKnowledgeById,
  getKnowledgeByIds,
  getLibraryFacets,
  getLibraryItems,
  getLibraryStats,
  getTodayFeed,
  updateKnowledgeItem,
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
    vi.mocked(repo.listKnowledgeItems).mockResolvedValue([vocab({ id: "a" }), vocab({ id: "b" })]);
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

const okCtxWithRole = (role: "owner" | "member") => ({
  status: "ok" as const,
  user,
  activeGroup: { id: "g1", name: "G", slug: "g" },
  membership: { groupId: "g1", userId: "u1", role },
});

describe("updateKnowledgeItem", () => {
  it("rejects a non-author, non-owner member", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: { ...user, id: "someone-else" } }),
    );
    await expect(
      updateKnowledgeItem("k1", {
        type: "vocabulary",
        level: null,
        tags: [],
        source: "manual",
        term: "x",
        meaning: "y",
        partOfSpeech: "z",
        example: null,
        exampleTranslation: null,
        article: null,
        plural: null,
        pastTense: null,
        perfect: null,
        usageNote: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.updateKnowledgeItem).not.toHaveBeenCalled();
  });

  it("allows the author", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(vocab({ id: "k1", addedBy: user }));
    vi.mocked(repo.updateKnowledgeItem).mockResolvedValue(vocab({ id: "k1" }));
    const result = await updateKnowledgeItem("k1", {
      type: "vocabulary",
      level: null,
      tags: [],
      source: "manual",
      term: "x",
      meaning: "y",
      partOfSpeech: "z",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    expect(result.id).toBe("k1");
  });

  it("allows the owner even if not the author", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("owner"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: { ...user, id: "someone-else" } }),
    );
    vi.mocked(repo.updateKnowledgeItem).mockResolvedValue(vocab({ id: "k1" }));
    const result = await updateKnowledgeItem("k1", {
      type: "vocabulary",
      level: null,
      tags: [],
      source: "manual",
      term: "x",
      meaning: "y",
      partOfSpeech: "z",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    expect(result.id).toBe("k1");
  });

  it("preserves the item's original source, ignoring input.source", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: user, source: "ai-assisted" }),
    );
    vi.mocked(repo.updateKnowledgeItem).mockResolvedValue(vocab({ id: "k1" }));
    await updateKnowledgeItem("k1", {
      type: "vocabulary",
      level: null,
      tags: [],
      source: "manual",
      term: "x",
      meaning: "y",
      partOfSpeech: "z",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    expect(repo.updateKnowledgeItem).toHaveBeenCalledWith(
      expect.anything(),
      "g1",
      "k1",
      "u1",
      expect.objectContaining({ source: "ai-assisted" }),
    );
  });

  it("rejects switching an item's type", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: user, type: "note" as never }),
    );
    await expect(
      updateKnowledgeItem("k1", {
        type: "vocabulary",
        level: null,
        tags: [],
        source: "manual",
        term: "x",
        meaning: "y",
        partOfSpeech: "z",
        example: null,
        exampleTranslation: null,
        article: null,
        plural: null,
        pastTense: null,
        perfect: null,
        usageNote: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("deleteKnowledgeItem", () => {
  it("rejects a non-author, non-owner member", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: { ...user, id: "someone-else" } }),
    );
    await expect(deleteKnowledgeItem("k1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(repo.softDeleteKnowledgeItem).not.toHaveBeenCalled();
  });

  it("allows the author and calls softDeleteKnowledgeItem", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(vocab({ id: "k1", addedBy: user }));
    vi.mocked(repo.softDeleteKnowledgeItem).mockResolvedValue(true);
    await deleteKnowledgeItem("k1");
    expect(repo.softDeleteKnowledgeItem).toHaveBeenCalledWith("g1", "k1");
  });

  it("throws NotFoundError if the item was already deleted concurrently", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(vocab({ id: "k1", addedBy: user }));
    vi.mocked(repo.softDeleteKnowledgeItem).mockResolvedValue(false);
    await expect(deleteKnowledgeItem("k1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createKnowledgeItems", () => {
  beforeEach(() => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx);
    vi.mocked(repo.insertKnowledgeItem).mockImplementation(
      async (_tx, row) =>
        ({
          ...vocab(),
          id: `id-${(row as { type: string }).type}`,
          type: (row as { type: string }).type,
        }) as never,
    );
  });

  it("inserts one row per input inside a single transaction and returns them", async () => {
    const out = await createKnowledgeItems([
      { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "n1" },
      { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "n2" },
    ]);
    expect(repo.insertKnowledgeItem).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(2);
  });

  it("maps a reading input with a computed wordCount", async () => {
    await createKnowledgeItems([
      {
        type: "reading",
        level: null,
        tags: [],
        source: "ai-assisted",
        title: "T",
        body: "een twee drie vier",
        summary: null,
      },
    ]);
    const row = vi.mocked(repo.insertKnowledgeItem).mock.calls[0][1] as Record<string, unknown>;
    expect(row).toMatchObject({ type: "reading", wordCount: 4, vocabularyIds: [] });
  });

  it("rolls the whole batch back when one row throws", async () => {
    vi.mocked(repo.insertKnowledgeItem)
      .mockResolvedValueOnce(vocab() as never)
      .mockRejectedValueOnce(new Error("db boom"));
    await expect(
      createKnowledgeItems([
        { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "ok" },
        { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "bad" },
      ]),
    ).rejects.toThrow("db boom");
  });
});

describe("duplicateKeyFromInput / duplicateKeyFromSuggestion", () => {
  it("keys vocabulary on term, grammar/reading on title, and ignores notes", () => {
    expect(
      duplicateKeyFromInput({
        type: "vocabulary",
        level: null,
        tags: [],
        source: "manual",
        term: " De Fiets ",
        meaning: "the bike",
        partOfSpeech: "noun",
        example: null,
        exampleTranslation: null,
        article: null,
        plural: null,
        pastTense: null,
        perfect: null,
        usageNote: null,
      }),
    ).toEqual({ type: "vocabulary", value: " De Fiets " });
    expect(
      duplicateKeyFromInput({
        type: "grammar",
        level: null,
        tags: [],
        source: "manual",
        title: "V2",
        summary: "s",
        explanation: "e",
        examples: [],
      }),
    ).toEqual({ type: "grammar", value: "V2" });
    expect(
      duplicateKeyFromInput({
        type: "note",
        level: null,
        tags: [],
        source: "manual",
        title: null,
        body: "n",
      }),
    ).toBeNull();
  });

  it("keys a suggestion the same way from its form-shaped fields", () => {
    expect(
      duplicateKeyFromSuggestion({ type: "vocabulary", fields: { term: "de hond" } }),
    ).toEqual({ type: "vocabulary", value: "de hond" });
    expect(
      duplicateKeyFromSuggestion({ type: "reading", fields: { title: "Een dag" } }),
    ).toEqual({ type: "reading", value: "Een dag" });
    expect(duplicateKeyFromSuggestion({ type: "note", fields: { noteBody: "n" } })).toBeNull();
  });
});

describe("findDuplicateKeys", () => {
  beforeEach(() => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx);
  });

  it("returns nothing and does not query when every key is null or blank", async () => {
    const out = await findDuplicateKeys([null, { type: "vocabulary", value: "   " }]);
    expect(out.size).toBe(0);
    expect(repo.findKnowledgeByNormalizedKey).not.toHaveBeenCalled();
  });

  it("matches case-insensitively and trims, mapping back to the caller's indices", async () => {
    vi.mocked(repo.findKnowledgeByNormalizedKey).mockResolvedValue([
      { id: "k1", type: "vocabulary", term: "de fiets", title: null },
      { id: "k2", type: "grammar", term: null, title: "Perfectum" },
    ]);

    const out = await findDuplicateKeys([
      { type: "vocabulary", value: "  DE FIETS " },
      { type: "grammar", value: "word order" },
      { type: "grammar", value: "perfectum" },
    ]);

    expect(repo.findKnowledgeByNormalizedKey).toHaveBeenCalledWith("g1", {
      vocabulary: ["de fiets"],
      grammar: ["word order", "perfectum"],
      reading: [],
    });
    expect(out.get(0)).toEqual({ existingId: "k1", label: "de fiets" });
    expect(out.has(1)).toBe(false);
    expect(out.get(2)).toEqual({ existingId: "k2", label: "Perfectum" });
  });

  it("uses the group id override without resolving context", async () => {
    vi.mocked(resolveActiveContext).mockRejectedValue(new Error("should not be called"));
    vi.mocked(repo.findKnowledgeByNormalizedKey).mockResolvedValue([]);
    await findDuplicateKeys([{ type: "vocabulary", value: "x" }], "g-override");
    expect(repo.findKnowledgeByNormalizedKey).toHaveBeenCalledWith(
      "g-override",
      expect.objectContaining({ vocabulary: ["x"] }),
    );
  });
});
