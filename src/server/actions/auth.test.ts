// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, createServerSupabaseClient } = vi.hoisted(() => ({
  redirect: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/server/active-group", () => ({ clearActiveGroupId: vi.fn() }));
vi.mock("@/server/auth/supabase", () => ({ createServerSupabaseClient }));
vi.mock("@/server/env", () => ({ serverEnv: { siteUrl: "https://dutch.omarcode.dev" } }));

import { sendMagicLink, verifyMagicLinkCode } from "./auth";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  redirect.mockReset();
  createServerSupabaseClient.mockReset();
});

describe("sendMagicLink", () => {
  it("preserves a valid invite token in the callback URL", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    createServerSupabaseClient.mockResolvedValue({ auth: { signInWithOtp } });

    await expect(
      sendMagicLink(null, formData({ email: "invitee@example.com", invite: "invite-token-123456" })),
    ).resolves.toEqual({ ok: true, data: undefined });

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "invitee@example.com",
      options: {
        emailRedirectTo:
          "https://dutch.omarcode.dev/auth/callback?token=invite-token-123456",
        shouldCreateUser: true,
      },
    });
  });
});

describe("verifyMagicLinkCode", () => {
  it("returns to the invite acceptance route after successful code verification", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    createServerSupabaseClient.mockResolvedValue({ auth: { verifyOtp } });

    await verifyMagicLinkCode(
      null,
      formData({
        email: "invitee@example.com",
        code: "12345678",
        invite: "invite-token-123456",
      }),
    );

    expect(redirect).toHaveBeenCalledWith("/invite/invite-token-123456");
  });
});
