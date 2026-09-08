// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminSupabaseClient } = vi.hoisted(() => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/server/auth/supabase", () => ({ createAdminSupabaseClient }));

import { GET } from "./route";

function req(secret?: string) {
  return new Request("https://app/api/cron/sweep-capture-staging", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const OLD = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const FRESH = new Date().toISOString();

function fakeStorage(objects: { name: string; created_at: string }[]) {
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const list = vi.fn().mockResolvedValue({ data: objects, error: null });
  return { client: { storage: { from: () => ({ list, remove }) } }, list, remove };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  createAdminSupabaseClient.mockReset();
});

describe("GET /api/cron/sweep-capture-staging", () => {
  it("401s without the bearer secret", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("401s with the wrong secret", async () => {
    const res = await GET(req("nope"));
    expect(res.status).toBe(401);
  });

  it("503s when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(req("anything"));
    expect(res.status).toBe(503);
  });

  it("deletes only objects older than one hour", async () => {
    const s = fakeStorage([
      { name: "u1/old.jpg", created_at: OLD },
      { name: "u1/fresh.jpg", created_at: FRESH },
    ]);
    createAdminSupabaseClient.mockReturnValue(s.client);

    const res = await GET(req("s3cret"));

    expect(res.status).toBe(200);
    expect(s.remove).toHaveBeenCalledWith(["u1/old.jpg"]);
    expect(await res.json()).toEqual({ deleted: 1 });
  });

  it("returns deleted: 0 and does not call remove when nothing is stale", async () => {
    const s = fakeStorage([{ name: "u1/fresh.jpg", created_at: FRESH }]);
    createAdminSupabaseClient.mockReturnValue(s.client);
    const res = await GET(req("s3cret"));
    expect(s.remove).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ deleted: 0 });
  });
});
