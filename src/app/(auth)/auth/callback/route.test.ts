// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/supabase", () => ({
  createRouteHandlerSupabaseClient: vi.fn(),
}));

import { createRouteHandlerSupabaseClient } from "@/server/auth/supabase";

import { GET } from "./route";

const ORIGIN = "https://dutch.omarcode.dev";

function mockAuth() {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
  const verifyOtp = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createRouteHandlerSupabaseClient).mockResolvedValue({
    auth: { exchangeCodeForSession, verifyOtp },
  } as never);
  return { exchangeCodeForSession, verifyOtp };
}

const get = (qs: string) => GET(new Request(`${ORIGIN}/auth/callback${qs}`));

beforeEach(() => vi.clearAllMocks());

describe("GET /auth/callback", () => {
  it("exchanges a PKCE code and redirects home", async () => {
    const { exchangeCodeForSession, verifyOtp } = mockAuth();
    const res = await get("?code=abc");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
  });

  it("verifies an invite token hash and bounces to the invite accept route", async () => {
    const { verifyOtp, exchangeCodeForSession } = mockAuth();
    const res = await get("?token_hash=h1&type=invite&token=app-tok");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "h1" });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/invite/app-tok`);
  });

  it("ignores an unknown otp type but still forwards to the invite route", async () => {
    const { verifyOtp } = mockAuth();
    const res = await get("?token_hash=h1&type=bogus&token=app-tok");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/invite/app-tok`);
  });

  it("redirects home when there is nothing to exchange", async () => {
    const { exchangeCodeForSession, verifyOtp } = mockAuth();
    const res = await get("");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
  });

  it("url-encodes the invite token in the redirect", async () => {
    mockAuth();
    const res = await get("?code=x&token=a%2Fb");
    expect(res.headers.get("location")).toBe(`${ORIGIN}/invite/a%2Fb`);
  });
});
