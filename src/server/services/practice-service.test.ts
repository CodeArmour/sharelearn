// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/knowledge", () => ({ listKnowledgeItems: vi.fn() }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { listKnowledgeItems } from "@/server/repositories/knowledge";
import { resolveActiveContext } from "@/server/services/session-service";

import { generateExamQuestions, generatePracticeQuestions } from "./practice-service";

const user = { id: "u1", name: "U", initials: "UU", avatarUrl: null };

function vocab(id: string, term: string, meaning: string, groupId: string) {
  return {
    id,
    groupId,
    type: "vocabulary" as const,
    level: "A2" as const,
    tags: [],
    source: "manual" as const,
    addedBy: user,
    createdAt: "2026-09-04T08:00:00.000Z",
    updatedAt: "2026-09-04T08:00:00.000Z",
    term,
    meaning,
    partOfSpeech: "Werkwoord",
    example: null,
    exampleTranslation: null,
    article: null,
    plural: null,
    pastTense: null,
    perfect: null,
    usageNote: null,
  };
}

beforeEach(() => {
  vi.mocked(resolveActiveContext).mockResolvedValue({
    status: "ok",
    user,
    activeGroup: { id: "g1", name: "G", slug: "g" },
    membership: { groupId: "g1", userId: "u1", role: "member" },
  });
});

describe("generatePracticeQuestions", () => {
  it("generates deterministic multiple-choice questions from the active group only", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      vocab("v1", "afspreken", "to arrange", "g1"),
      vocab("v2", "gezellig", "cozy", "g1"),
      vocab("v3", "de vergadering", "the meeting", "g1"),
      vocab("v4", "af en toe", "from time to time", "g1"),
    ] as never);

    const first = await generatePracticeQuestions({ mode: "vocabulary", scope: "all", length: 0 });
    const second = await generatePracticeQuestions({ mode: "vocabulary", scope: "all", length: 0 });
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    for (const q of first) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  it("never leaks another group's vocabulary into distractors", async () => {
    // listKnowledgeItems is called with the resolved group id only — assert the
    // service never queries or mixes in a second group's data.
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      vocab("v1", "afspreken", "to arrange", "g1"),
    ] as never);
    await generatePracticeQuestions({ mode: "vocabulary", scope: "all", length: 0 });
    expect(listKnowledgeItems).toHaveBeenCalledWith("g1", {});
    expect(listKnowledgeItems).toHaveBeenCalledTimes(1);
  });

  it("throws when there is no active group", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue({ status: "no-access" });
    await expect(
      generatePracticeQuestions({ mode: "mixed", scope: "all", length: 0 }),
    ).rejects.toThrow();
  });
});

describe("generateExamQuestions", () => {
  it("draws from the same pool as practice", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      vocab("v1", "afspreken", "to arrange", "g1"),
      vocab("v2", "gezellig", "cozy", "g1"),
    ] as never);
    const qs = await generateExamQuestions({ mode: "vocabulary", scope: "all", length: 0 });
    expect(qs.length).toBeGreaterThan(0);
  });
});
