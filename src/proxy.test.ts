// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { proxy } from "./proxy";

function req(path: string) {
  return new NextRequest(new URL(`http://localhost:3000${path}`));
}

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("proxy", () => {
  it("redirects an unauthenticated app path to /login", async () => {
    const res = await proxy(req("/today"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("lets an unauthenticated user reach /login", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated user away from /login", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("does not gate /groups (no session check redirect loop)", async () => {
    const res = await proxy(req("/groups"));
    expect(res.headers.get("location")).toBeNull();
  });
});
