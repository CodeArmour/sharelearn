// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listGrammarMissingQuiz, ensureGrammarQuiz } = vi.hoisted(() => ({
  listGrammarMissingQuiz: vi.fn(),
  ensureGrammarQuiz: vi.fn(),
}));
vi.mock("@/server/repositories/knowledge", () => ({ listGrammarMissingQuiz }));
vi.mock("@/server/services/grammar-quiz-service", () => ({ ensureGrammarQuiz }));

import { GET } from "./route";

function req(secret?: string) {
  return new Request("https://app/api/cron/backfill-grammar-quiz", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const row = (id: string) => ({
  id,
  groupId: "g1",
  title: "T",
  summary: "S",
  explanation: "E",
  examples: [],
  level: "A2",
  grammarQuiz: null,
});

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  listGrammarMissingQuiz.mockReset();
  ensureGrammarQuiz.mockReset();
});

describe("GET /api/cron/backfill-grammar-quiz", () => {
  it("503s when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("anything"))).status).toBe(503);
  });

  it("401s without / with a wrong bearer", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("nope"))).status).toBe(401);
  });

  it("generates for each missing-quiz grammar item and counts the successes", async () => {
    listGrammarMissingQuiz.mockResolvedValue([row("g1"), row("g2")]);
    ensureGrammarQuiz
      .mockResolvedValueOnce({ generated: true })
      .mockResolvedValueOnce({ generated: false });

    const res = await GET(req("s3cret"));

    expect(res.status).toBe(200);
    expect(ensureGrammarQuiz).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ generated: 1 });
  });

  it("returns generated: 0 when nothing is missing", async () => {
    listGrammarMissingQuiz.mockResolvedValue([]);
    const res = await GET(req("s3cret"));
    expect(ensureGrammarQuiz).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ generated: 0 });
  });
});
