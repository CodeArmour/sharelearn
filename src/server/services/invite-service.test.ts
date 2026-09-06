// @vitest-environment node
import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/auth/supabase", () => ({
  createServerSupabaseClient: vi.fn(),
  createAdminSupabaseClient: vi.fn(),
}));
vi.mock("@/server/active-group", () => ({
  readActiveGroupId: vi.fn(),
  writeActiveGroupId: vi.fn(),
}));
vi.mock("@/server/repositories/groups", () => ({
  getMembership: vi.fn(),
}));
vi.mock("@/server/repositories/memberships", () => ({
  getRole: vi.fn(),
  createMembership: vi.fn(),
}));
vi.mock("@/server/repositories/invitations", () => ({
  getByToken: vi.fn(),
  getById: vi.fn(),
  getPendingByEmail: vi.fn(),
  createInvitation: vi.fn(),
  markAccepted: vi.fn(),
  markRevoked: vi.fn(),
}));
vi.mock("@/server/repositories/profiles", () => ({ upsertProfile: vi.fn() }));
vi.mock("@/server/env", () => ({ serverEnv: { siteUrl: "http://localhost:3000" } }));
vi.mock("@/server/db/client", () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext: vi.fn() }));

import { writeActiveGroupId } from "@/server/active-group";
import { getCurrentUser } from "@/server/auth/session";
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/server/auth/supabase";
import {
  ConflictError,
  EmailSendError,
  ForbiddenError,
  InviteError,
  NotFoundError,
  ValidationError,
} from "@/server/errors";
import { getMembership } from "@/server/repositories/groups";
import {
  createInvitation,
  getById,
  getByToken,
  getPendingByEmail,
  markAccepted,
  markRevoked,
} from "@/server/repositories/invitations";
import { createMembership, getRole } from "@/server/repositories/memberships";
import { upsertProfile } from "@/server/repositories/profiles";
import { resolveActiveContext } from "@/server/services/session-service";

import { acceptInvitation, inviteMember, revokeInvitation } from "./invite-service";

const OWNER = randomUUID();
const GROUP = randomUUID();

/**
 * Wire the invite send path: `admin.auth.admin.inviteUserByEmail` (primary) and
 * `supabase.auth.signInWithOtp` (the already-registered fallback).
 */
function mockInvite(
  inviteResult: { error: unknown } = { error: null },
  otpResult: { error: unknown } = { error: null },
) {
  const inviteUserByEmail = vi.fn().mockResolvedValue(inviteResult);
  const signInWithOtp = vi.fn().mockResolvedValue(otpResult);
  vi.mocked(createAdminSupabaseClient).mockReturnValue({
    auth: { admin: { inviteUserByEmail } },
  } as never);
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { signInWithOtp },
  } as never);
  return { inviteUserByEmail, signInWithOtp };
}

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: OWNER,
    name: "O",
    initials: "OO",
    avatarUrl: null,
  });
});

describe("inviteMember", () => {
  const okCtx = (role: "owner" | "member") => ({
    status: "ok" as const,
    user: { id: OWNER, name: "O", initials: "OO", avatarUrl: null },
    activeGroup: { id: GROUP, name: "G", slug: "g" },
    membership: { groupId: GROUP, userId: OWNER, role },
  });

  beforeEach(() => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx("owner"));
    vi.mocked(getPendingByEmail).mockResolvedValue([]);
    vi.mocked(getMembership).mockResolvedValue(null);
  });

  it("rejects a non-owner", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx("member"));
    await expect(inviteMember({ email: "a@b.com" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects an invalid email", async () => {
    mockInvite();
    await expect(inviteMember({ email: "not-an-email" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a duplicate pending invite", async () => {
    vi.mocked(getPendingByEmail).mockResolvedValue([{ groupId: GROUP } as never]);
    await expect(inviteMember({ email: "a@b.com" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("creates the row and sends the invite email on the happy path", async () => {
    const { inviteUserByEmail, signInWithOtp } = mockInvite();
    vi.mocked(createInvitation).mockResolvedValue({ id: "i1", email: "a@b.com" } as never);
    const res = await inviteMember({ email: "a@b.com" });
    expect(res).toMatchObject({ id: "i1", email: "a@b.com" });
    expect(createInvitation).toHaveBeenCalled();
    const [emailArg, optsArg] = inviteUserByEmail.mock.calls[0];
    expect(emailArg).toBe("a@b.com");
    expect(optsArg.redirectTo).toMatch(/\/auth\/callback\?token=/);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("falls back to a magic link when the auth user already exists", async () => {
    const { signInWithOtp } = mockInvite({
      error: { code: "email_exists", message: "A user with this email has already been registered" },
    });
    vi.mocked(createInvitation).mockResolvedValue({ id: "i1", email: "a@b.com" } as never);
    const res = await inviteMember({ email: "a@b.com" });
    expect(res).toMatchObject({ id: "i1", email: "a@b.com" });
    const arg = signInWithOtp.mock.calls[0][0];
    expect(arg.email).toBe("a@b.com");
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/callback\?token=/);
    expect(markRevoked).not.toHaveBeenCalled();
  });

  it("revokes the invitation row and throws EmailSendError when the send fails", async () => {
    mockInvite({ error: { message: "email rate limit exceeded" } });
    vi.mocked(createInvitation).mockResolvedValue({ id: "i1", email: "a@b.com" } as never);

    await expect(inviteMember({ email: "a@b.com" })).rejects.toBeInstanceOf(EmailSendError);
    expect(markRevoked).toHaveBeenCalledWith("i1");
  });

  it("revokes the row when the already-exists fallback also fails", async () => {
    mockInvite(
      { error: { code: "email_exists", message: "already registered" } },
      { error: { message: "smtp unavailable" } },
    );
    vi.mocked(createInvitation).mockResolvedValue({ id: "i1", email: "a@b.com" } as never);

    await expect(inviteMember({ email: "a@b.com" })).rejects.toBeInstanceOf(EmailSendError);
    expect(markRevoked).toHaveBeenCalledWith("i1");
  });
});

describe("acceptInvitation", () => {
  const INVITEE = randomUUID();

  const pendingInvite = () => ({
    id: "i",
    groupId: GROUP,
    email: "invitee@x.com",
    token: "t",
    role: "member" as const,
    invitedBy: OWNER,
    status: "pending" as const,
    expiresAt: new Date(Date.now() + 1e6),
    acceptedAt: null,
    createdAt: new Date(),
  });

  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: INVITEE,
      name: "I",
      initials: "II",
      avatarUrl: null,
    });
    // getCurrentUser doesn't carry email; the service re-reads it from supabase.
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: INVITEE, email: "invitee@x.com" } } }),
      },
    } as never);
  });

  it("not-found when the token is unknown", async () => {
    vi.mocked(getByToken).mockResolvedValue(null);
    await expect(acceptInvitation({ token: "nope" })).rejects.toBeInstanceOf(InviteError);
    await expect(acceptInvitation({ token: "nope" })).rejects.toMatchObject({
      inviteCode: "not-found",
    });
  });

  it("revoked when status is revoked", async () => {
    vi.mocked(getByToken).mockResolvedValue({
      ...pendingInvite(),
      status: "revoked",
    } as never);
    await expect(acceptInvitation({ token: "t" })).rejects.toMatchObject({ inviteCode: "revoked" });
  });

  it("expired when past expiresAt", async () => {
    vi.mocked(getByToken).mockResolvedValue({
      ...pendingInvite(),
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    await expect(acceptInvitation({ token: "t" })).rejects.toMatchObject({ inviteCode: "expired" });
  });

  it("email-mismatch when the session email differs", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: INVITEE, email: "someone@else.com" } } }),
      },
    } as never);
    vi.mocked(getByToken).mockResolvedValue(pendingInvite());
    vi.mocked(getMembership).mockResolvedValue(null);
    await expect(acceptInvitation({ token: "t" })).rejects.toMatchObject({
      inviteCode: "email-mismatch",
    });
    expect(createMembership).not.toHaveBeenCalled();
  });

  it("already-member when a membership already exists", async () => {
    vi.mocked(getByToken).mockResolvedValue(pendingInvite());
    vi.mocked(getMembership).mockResolvedValue({ id: "m" } as never);
    await expect(acceptInvitation({ token: "t" })).rejects.toMatchObject({
      inviteCode: "already-member",
    });
  });

  it("happy path: creates membership, marks accepted, sets the cookie", async () => {
    vi.mocked(getByToken).mockResolvedValue(pendingInvite());
    vi.mocked(getMembership).mockResolvedValue(null);
    const res = await acceptInvitation({ token: "t" });
    expect(res).toEqual({ groupId: GROUP });
    expect(createMembership).toHaveBeenCalled();
    expect(markAccepted).toHaveBeenCalled();
    expect(upsertProfile).toHaveBeenCalled();
    expect(writeActiveGroupId).toHaveBeenCalledWith(GROUP);
  });

  it("compares the email case-insensitively on the happy path", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: INVITEE, email: "INVITEE@X.com" } } }),
      },
    } as never);
    vi.mocked(getByToken).mockResolvedValue({
      ...pendingInvite(),
      email: "invitee@x.com",
    } as never);
    vi.mocked(getMembership).mockResolvedValue(null);
    const res = await acceptInvitation({ token: "t" });
    expect(res).toEqual({ groupId: GROUP });
    expect(createMembership).toHaveBeenCalled();
  });
});

describe("revokeInvitation", () => {
  const invite = (groupId: string) => ({
    id: "i1",
    groupId,
    email: "invitee@x.com",
    token: "t",
    role: "member" as const,
    invitedBy: OWNER,
    status: "pending" as const,
    expiresAt: new Date(Date.now() + 1e6),
    acceptedAt: null,
    createdAt: new Date(),
  });

  beforeEach(() => {
    vi.mocked(getById).mockResolvedValue(invite(GROUP));
    vi.mocked(getRole).mockResolvedValue("owner");
  });

  it("rejects a non-owner", async () => {
    vi.mocked(getRole).mockResolvedValue("member");
    await expect(revokeInvitation({ invitationId: "i1" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(markRevoked).not.toHaveBeenCalled();
  });

  it("revokes for an owner", async () => {
    await revokeInvitation({ invitationId: "i1" });
    expect(markRevoked).toHaveBeenCalledWith("i1");
  });

  it("rejects when the invitation does not exist", async () => {
    vi.mocked(getById).mockResolvedValue(null);
    await expect(revokeInvitation({ invitationId: "i1" })).rejects.toBeInstanceOf(NotFoundError);
    expect(markRevoked).not.toHaveBeenCalled();
  });

  it("rejects an owner of a different group", async () => {
    vi.mocked(getById).mockResolvedValue(invite("other-group"));
    vi.mocked(getRole).mockImplementation(async (_userId, groupId) =>
      groupId === GROUP ? "owner" : null,
    );
    await expect(revokeInvitation({ invitationId: "i1" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(markRevoked).not.toHaveBeenCalled();
  });
});
