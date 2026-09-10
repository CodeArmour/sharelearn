// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listReadingsMissingQuiz, ensureReadingQuiz } = vi.hoisted(() => ({
  listReadingsMissingQuiz: vi.fn(),
  ensureReadingQuiz: vi.fn(),
}));
vi.mock("@/server/repositories/knowledge", () => ({ listReadingsMissingQuiz }));
vi.mock("@/server/services/reading-quiz-service", () => ({ ensureReadingQuiz }));

import { GET } from "./route";

function req(secret?: string) {
  return new Request("https://app/api/cron/backfill-reading-quiz", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const row = (id: string) => ({
  id,
  groupId: "g1",
  title: "T",
  body: "b",
  level: "B1",
  readingQuiz: null,
});

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  listReadingsMissingQuiz.mockReset();
  ensureReadingQuiz.mockReset();
});

describe("GET /api/cron/backfill-reading-quiz", () => {
  it("503s when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("anything"))).status).toBe(503);
  });

  it("401s without / with a wrong bearer", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("nope"))).status).toBe(401);
  });

  it("generates for each missing-quiz reading and counts the successes", async () => {
    listReadingsMissingQuiz.mockResolvedValue([row("r1"), row("r2")]);
    ensureReadingQuiz
      .mockResolvedValueOnce({ generated: true })
      .mockResolvedValueOnce({ generated: false });

    const res = await GET(req("s3cret"));

    expect(res.status).toBe(200);
    expect(ensureReadingQuiz).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ generated: 1 });
  });

  it("returns generated: 0 when nothing is missing", async () => {
    listReadingsMissingQuiz.mockResolvedValue([]);
    const res = await GET(req("s3cret"));
    expect(ensureReadingQuiz).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ generated: 0 });
  });
});
