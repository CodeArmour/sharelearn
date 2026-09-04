// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/server/repositories/groups", () => ({
  listGroupsForUser: vi.fn(),
}));
vi.mock("@/server/active-group", () => ({
  readActiveGroupId: vi.fn(),
  writeActiveGroupId: vi.fn(),
  clearActiveGroupId: vi.fn(),
}));

import { readActiveGroupId, writeActiveGroupId, clearActiveGroupId } from "@/server/active-group";
import { getCurrentUser } from "@/server/auth/session";
import { listGroupsForUser } from "@/server/repositories/groups";

import { resolveActiveContext } from "./session-service";

const user = { id: "u1", name: "U", initials: "UU", avatarUrl: null };
const g1 = { id: "g1", name: "One", slug: "one", role: "owner" as const };
const g2 = { id: "g2", name: "Two", slug: "two", role: "member" as const };

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
  vi.mocked(readActiveGroupId).mockResolvedValue(null);
  vi.mocked(listGroupsForUser).mockResolvedValue([]);
});

describe("resolveActiveContext", () => {
  it("needs-login when there is no user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await resolveActiveContext()).toEqual({ status: "needs-login" });
  });

  it("no-access when the user has zero memberships", async () => {
    expect(await resolveActiveContext()).toEqual({ status: "no-access" });
  });

  it("auto-selects the only membership when no cookie is set", async () => {
    vi.mocked(listGroupsForUser).mockResolvedValue([g1]);
    const ctx = await resolveActiveContext();
    expect(ctx).toMatchObject({ status: "ok", activeGroup: { id: "g1" } });
    expect(writeActiveGroupId).toHaveBeenCalledWith("g1");
  });

  it("needs-group with multiple memberships and no cookie", async () => {
    vi.mocked(listGroupsForUser).mockResolvedValue([g1, g2]);
    expect(await resolveActiveContext()).toEqual({ status: "needs-group" });
  });

  it("returns ok for a valid cookie", async () => {
    vi.mocked(listGroupsForUser).mockResolvedValue([g1, g2]);
    vi.mocked(readActiveGroupId).mockResolvedValue("g2");
    const ctx = await resolveActiveContext();
    expect(ctx).toMatchObject({
      status: "ok",
      activeGroup: { id: "g2", name: "Two", slug: "two" },
      membership: { groupId: "g2", userId: "u1", role: "member" },
    });
  });

  it("clears a stale cookie then falls through to needs-group", async () => {
    vi.mocked(listGroupsForUser).mockResolvedValue([g1, g2]);
    vi.mocked(readActiveGroupId).mockResolvedValue("gX");
    expect(await resolveActiveContext()).toEqual({ status: "needs-group" });
    expect(clearActiveGroupId).toHaveBeenCalled();
  });
});
