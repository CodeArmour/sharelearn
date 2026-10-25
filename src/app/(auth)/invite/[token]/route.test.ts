// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/server/services/invite-service", () => ({ acceptInvitation: vi.fn() }));

import { getSession } from "@/server/auth/session";

import { GET } from "./route";

const ORIGIN = "https://dutch.omarcode.dev";

beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

describe("GET /invite/[token]", () => {
  it("preserves the invitation token when authentication is still required", async () => {
    const response = await GET(new Request(`${ORIGIN}/invite/invite-token-123456`), {
      params: Promise.resolve({ token: "invite-token-123456" }),
    });

    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/login?invite=invite-token-123456`,
    );
  });
});
