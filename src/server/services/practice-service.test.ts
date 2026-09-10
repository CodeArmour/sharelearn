// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/knowledge", () => ({ listKnowledgeItems: vi.fn() }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { listKnowledgeItems } from "@/server/repositories/knowledge";
import { resolveActiveContext } from "@/server/services/session-service";

import type { ReadingQuiz } from "@/types";

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

const sampleQuiz: ReadingQuiz = {
  promptVersion: "v1",
  generatedAt: "2026-09-09T00:00:00.000Z",
  sourceHash: "hash",
  questions: [
    { id: "q1", kind: "mcq", prompt: "Waarover gaat de tekst?", options: ["A", "B", "C", "D"], correctIndex: 0 },
    { id: "q2", kind: "true-false", prompt: "De tekst is waar.", options: ["Waar", "Onwaar"], correctIndex: 0 },
  ],
};

function reading(id: string, title: string, groupId: string, quiz: ReadingQuiz | null) {
  return {
    id,
    groupId,
    type: "reading" as const,
    level: "B1" as const,
    tags: [],
    source: "manual" as const,
    addedBy: user,
    updatedBy: null,
    createdAt: "2026-09-04T08:00:00.000Z",
    updatedAt: "2026-09-04T08:00:00.000Z",
    title,
    body: `Body of ${title}`,
    wordCount: 10,
    summary: null,
    vocabularyIds: [],
    readingQuiz: quiz,
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

describe("generatePracticeQuestions — reading", () => {
  it("emits one question per stored quiz question, with the passage attached", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      reading("r1", "Op de markt", "g1", sampleQuiz),
      vocab("v1", "afspreken", "to arrange", "g1"),
    ] as never);

    const qs = await generatePracticeQuestions({ mode: "reading", scope: "all", length: 0 });

    expect(qs).toHaveLength(2);
    expect(qs.map((q) => q.id)).toEqual(["q_r1_q1", "q_r1_q2"]);
    for (const q of qs) {
      expect(q.knowledgeType).toBe("reading");
      expect(q.knowledgeId).toBe("r1");
      expect(q.passage).toEqual({ id: "r1", title: "Op de markt", body: "Body of Op de markt" });
    }
    expect(qs[0].instructionKey).toBe("readComprehension");
    expect(qs[1].instructionKey).toBe("trueOrFalse");
  });

  it("skips readings that have no stored quiz", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      reading("r1", "Zonder quiz", "g1", null),
    ] as never);
    const qs = await generatePracticeQuestions({ mode: "reading", scope: "all", length: 0 });
    expect(qs).toEqual([]);
  });

  it("mode 'mixed' draws vocab, grammar and reading", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      reading("r1", "Op de markt", "g1", sampleQuiz),
      vocab("v1", "afspreken", "to arrange", "g1"),
      vocab("v2", "gezellig", "cozy", "g1"),
    ] as never);
    const qs = await generatePracticeQuestions({ mode: "mixed", scope: "all", length: 0 });
    expect(qs.some((q) => q.knowledgeType === "reading")).toBe(true);
    expect(qs.some((q) => q.knowledgeType === "vocabulary")).toBe(true);
  });

  it("keeps a passage's questions contiguous after the sort", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      reading("r1", "Eerste", "g1", sampleQuiz),
      reading("r2", "Tweede", "g1", sampleQuiz),
    ] as never);
    const qs = await generatePracticeQuestions({ mode: "reading", scope: "all", length: 0 });
    const ids = qs.map((q) => q.passage!.id);
    // no interleaving: every run of one id is a single block
    const runs = ids.filter((id, i) => id !== ids[i - 1]);
    expect(runs).toHaveLength(new Set(ids).size);
  });

  it("respects setup.length across the combined set", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      reading("r1", "Op de markt", "g1", sampleQuiz),
    ] as never);
    const qs = await generatePracticeQuestions({ mode: "reading", scope: "all", length: 1 });
    expect(qs).toHaveLength(1);
  });
});
