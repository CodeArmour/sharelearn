import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

describe("createBrowserSupabaseClient", () => {
  it("returns a client exposing storage", async () => {
    const { createBrowserSupabaseClient } = await import("./browser");
    const client = createBrowserSupabaseClient();
    expect(typeof client.storage.from).toBe("function");
  });
});
