// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/personal", () => ({
  listReviewMarks: vi.fn(),
  addReviewMark: vi.fn(),
  removeReviewMark: vi.fn(),
  replaceReviewMarks: vi.fn(),
  insertStudyRun: vi.fn(),
  listStudyRuns: vi.fn(),
  getStudyRunTotals: vi.fn(),
}));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { NotFoundError, ValidationError } from "@/server/errors";
import * as repo from "@/server/repositories/personal";
import { resolveActiveContext } from "@/server/services/session-service";
import type { StudyRunInput } from "@/types";

import {
  getReviewMarks,
  getStudyHistory,
  importLocalReviewMarks,
  recordStudyRun,
  toggleReviewMark,
} from "./personal-service";

const okCtx = {
  status: "ok" as const,
  user: { id: "u1", name: "U", initials: "UU", avatarUrl: null },
  activeGroup: { id: "g1", name: "G", slug: "g" },
  membership: { groupId: "g1", userId: "u1", role: "member" as const },
};

const practiceInput: StudyRunInput = {
  kind: "practice",
  mode: "mixed",
  scope: "all",
  level: null,
  questionCount: 10,
  correctCount: 8,
  startedAt: "2026-09-01T10:00:00.000Z",
  completedAt: "2026-09-01T10:05:00.000Z",
};

beforeEach(() => {
  vi.mocked(resolveActiveContext).mockResolvedValue(okCtx);
});

describe("guards", () => {
  it("every entry throws when there is no active group", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue({ status: "needs-group" });
    await expect(getReviewMarks()).rejects.toBeInstanceOf(NotFoundError);
    await expect(toggleReviewMark("11111111-1111-4111-8111-111111111111")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(recordStudyRun(practiceInput)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getStudyHistory()).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("toggleReviewMark", () => {
  it("adds when absent and returns marked: true", async () => {
    vi.mocked(repo.listReviewMarks).mockResolvedValue([]);
    const result = await toggleReviewMark("k1");
    expect(result).toEqual({ marked: true });
    expect(repo.addReviewMark).toHaveBeenCalledWith("u1", "g1", "k1");
    expect(repo.removeReviewMark).not.toHaveBeenCalled();
  });

  it("removes when present and returns marked: false", async () => {
    vi.mocked(repo.listReviewMarks).mockResolvedValue([
      { knowledgeId: "k1", markedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    const result = await toggleReviewMark("k1");
    expect(result).toEqual({ marked: false });
    expect(repo.removeReviewMark).toHaveBeenCalledWith("u1", "g1", "k1");
    expect(repo.addReviewMark).not.toHaveBeenCalled();
  });
});

describe("importLocalReviewMarks", () => {
  it("dedupes and passes the count through", async () => {
    vi.mocked(repo.replaceReviewMarks).mockResolvedValue(2);
    const result = await importLocalReviewMarks(["a", "a", "b"]);
    expect(repo.replaceReviewMarks).toHaveBeenCalledWith("u1", "g1", ["a", "b"]);
    expect(result).toEqual({ imported: 2 });
  });
});

describe("recordStudyRun", () => {
  it("passes a valid practice run through to the repo", async () => {
    vi.mocked(repo.insertStudyRun).mockResolvedValue({
      ...practiceInput,
      id: "r1",
      scorePercent: 80,
    });
    const result = await recordStudyRun(practiceInput);
    expect(result.id).toBe("r1");
    expect(repo.insertStudyRun).toHaveBeenCalledWith("u1", "g1", practiceInput);
  });

  it("forces level to null when scope is not 'level'", async () => {
    vi.mocked(repo.insertStudyRun).mockResolvedValue({
      ...practiceInput,
      id: "r1",
      scorePercent: 80,
    });
    await recordStudyRun({ ...practiceInput, scope: "all", level: "A2" });
    expect(repo.insertStudyRun).toHaveBeenCalledWith(
      "u1",
      "g1",
      expect.objectContaining({ level: null }),
    );
  });

  it("keeps level when scope is 'level'", async () => {
    vi.mocked(repo.insertStudyRun).mockResolvedValue({
      ...practiceInput,
      id: "r1",
      scorePercent: 80,
    });
    await recordStudyRun({ ...practiceInput, scope: "level", level: "B1" });
    expect(repo.insertStudyRun).toHaveBeenCalledWith(
      "u1",
      "g1",
      expect.objectContaining({ scope: "level", level: "B1" }),
    );
  });

  it("rejects correctCount > questionCount", async () => {
    await expect(
      recordStudyRun({ ...practiceInput, correctCount: 11 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a practice run with no mode", async () => {
    await expect(
      recordStudyRun({ ...practiceInput, mode: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an exam run that carries a mode", async () => {
    await expect(
      recordStudyRun({ ...practiceInput, kind: "exam", mode: "mixed" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects startedAt after completedAt", async () => {
    await expect(
      recordStudyRun({
        ...practiceInput,
        startedAt: "2026-09-01T10:10:00.000Z",
        completedAt: "2026-09-01T10:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a run whose timestamps are not parseable dates (NaN-safe)", async () => {
    await expect(
      recordStudyRun({ ...practiceInput, startedAt: "not-a-date" }),
    ).rejects.toThrow("startedAt is after completedAt");
    await expect(
      recordStudyRun({ ...practiceInput, completedAt: "also-not-a-date" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.insertStudyRun).not.toHaveBeenCalled();
  });
});

describe("getStudyHistory", () => {
  it("assembles runs, totals and markedCount; default limit 10", async () => {
    vi.mocked(repo.listStudyRuns).mockResolvedValue([]);
    vi.mocked(repo.getStudyRunTotals).mockResolvedValue({ runCount: 3, avgScorePercent: 62 });
    vi.mocked(repo.listReviewMarks).mockResolvedValue([
      { knowledgeId: "k1", markedAt: "2026-09-01T00:00:00.000Z" },
      { knowledgeId: "k2", markedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    const history = await getStudyHistory();
    expect(repo.listStudyRuns).toHaveBeenCalledWith("u1", "g1", 10);
    expect(history.totals).toEqual({ runCount: 3, avgScorePercent: 62 });
    expect(history.markedCount).toBe(2);
  });
});
