// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/active-group", () => ({
  readActiveGroupId: vi.fn(),
  writeActiveGroupId: vi.fn(),
}));
vi.mock("@/server/repositories/groups", () => ({
  listGroupsForUser: vi.fn(),
  getGroupById: vi.fn(),
  getMembership: vi.fn(),
}));
vi.mock("@/server/repositories/memberships", () => ({
  listMembers: vi.fn(),
  getRole: vi.fn(),
}));
vi.mock("@/server/repositories/invitations", () => ({ listPendingForGroup: vi.fn() }));
vi.mock("@/server/repositories/profiles", () => ({ getProfile: vi.fn() }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { writeActiveGroupId } from "@/server/active-group";
import { getCurrentUser } from "@/server/auth/session";
import { getMembership, listGroupsForUser } from "@/server/repositories/groups";
import { listMembers } from "@/server/repositories/memberships";
import { listPendingForGroup } from "@/server/repositories/invitations";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { resolveActiveContext } from "@/server/services/session-service";
import { getGroupSettings, getGroupsForPicker, switchActiveGroup } from "./group-service";

const user = { id: "u1", name: "U", initials: "UU", avatarUrl: null };

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
});

describe("getGroupsForPicker", () => {
  it("throws when signed out", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(getGroupsForPicker()).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("returns the user's groups", async () => {
    vi.mocked(listGroupsForUser).mockResolvedValue([
      { id: "g1", name: "G", slug: "g", role: "member" },
    ]);
    expect((await getGroupsForPicker()).length).toBe(1);
  });
});

describe("switchActiveGroup", () => {
  it("rejects a non-member", async () => {
    vi.mocked(getMembership).mockResolvedValue(null);
    await expect(switchActiveGroup("g9")).rejects.toBeInstanceOf(ForbiddenError);
    expect(writeActiveGroupId).not.toHaveBeenCalled();
  });
  it("writes the cookie for a member", async () => {
    vi.mocked(getMembership).mockResolvedValue({ id: "m", groupId: "g1", userId: "u1", role: "member", createdAt: new Date() });
    await switchActiveGroup("g1");
    expect(writeActiveGroupId).toHaveBeenCalledWith("g1");
  });
});

describe("getGroupSettings", () => {
  const okCtx = (role: "owner" | "member") => ({
    status: "ok" as const,
    user,
    activeGroup: { id: "g1", name: "G", slug: "g" },
    membership: { groupId: "g1", userId: "u1", role },
  });

  beforeEach(() => {
    vi.mocked(listMembers).mockResolvedValue([]);
  });

  it("throws when no active group resolves", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue({ status: "needs-group" });
    await expect(getGroupSettings()).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides pending invites from a member", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx("member"));
    const view = await getGroupSettings();
    expect(view.viewerRole).toBe("member");
    expect(view.pendingInvites).toEqual([]);
    expect(listPendingForGroup).not.toHaveBeenCalled();
  });

  it("includes pending invites for an owner", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx("owner"));
    vi.mocked(listPendingForGroup).mockResolvedValue([
      {
        id: "i1", groupId: "g1", email: "x@y.z", token: "t", role: "member",
        invitedBy: "u1", status: "pending",
        expiresAt: new Date("2030-01-01"), acceptedAt: null, createdAt: new Date("2026-01-01"),
      },
    ]);
    const view = await getGroupSettings();
    expect(view.pendingInvites).toHaveLength(1);
    expect(view.pendingInvites[0]).toMatchObject({ id: "i1", email: "x@y.z" });
  });
});
