import "server-only";

import { randomBytes } from "node:crypto";

import { writeActiveGroupId } from "@/server/active-group";
import { deriveAccent, deriveInitials } from "@/server/auth/identity";
import { getCurrentUser } from "@/server/auth/session";
import { createServerSupabaseClient } from "@/server/auth/supabase";
import { db, type Db } from "@/server/db/client";
import { serverEnv } from "@/server/env";
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

export type { InviteErrorCode } from "@/types";
export { InviteError } from "@/server/errors";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function inviteMember(input: {
  email: string;
}): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError("Enter a valid email address");

  // Re-derive the active group the same self-healing way (app)/layout does —
  // a raw cookie read can't be trusted (see resolveActiveContext).
  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") throw new NotFoundError("No active group");
  const groupId = ctx.activeGroup.id;
  if (ctx.membership.role !== "owner") throw new ForbiddenError("Only an owner can invite members");

  const existingPending = (await getPendingByEmail(email)).filter((i) => i.groupId === groupId);
  if (existingPending.length > 0) {
    throw new ConflictError("That email already has a pending invite");
  }

  const token = generateInviteToken();
  const row = await db.transaction((tx) =>
    createInvitation(tx as unknown as Db, {
      groupId,
      email,
      token,
      role: "member",
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    }),
  );

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${serverEnv.siteUrl}/auth/callback?token=${token}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    // The invitation row above already committed — without this, a failed
    // send (e.g. hitting Supabase's auth email rate limit) leaves an
    // orphaned "pending" invite with no email ever sent, and blocks any
    // retry via the existingPending check above until someone manually
    // revokes it. Revoking here keeps a record of the attempt (for
    // debugging) while freeing the email up to invite again immediately.
    await markRevoked(row.id);
    throw new EmailSendError(error.message);
  }

  return { id: row.id, email: row.email };
}

export async function acceptInvitation(input: { token: string }): Promise<{ groupId: string }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) throw new NotFoundError("Not signed in");

  const invite = await getByToken(input.token);
  if (!invite) throw new InviteError("not-found");
  if (invite.status === "revoked") throw new InviteError("revoked");
  if (invite.status === "accepted") {
    // Already used — treat as already-member if this user, else not-found.
    const existing = await getMembership(authUser.id, invite.groupId);
    throw new InviteError(existing ? "already-member" : "not-found");
  }
  if (invite.expiresAt.getTime() < Date.now()) throw new InviteError("expired");

  const sessionEmail = (authUser.email ?? "").toLowerCase();
  if (sessionEmail !== invite.email.toLowerCase()) throw new InviteError("email-mismatch");

  if (await getMembership(authUser.id, invite.groupId)) throw new InviteError("already-member");

  await db.transaction(async (tx) => {
    const dbtx = tx as unknown as Db;
    await createMembership(dbtx, {
      groupId: invite.groupId,
      userId: authUser.id,
      role: invite.role,
    });
    await markAccepted(dbtx, invite.id);
    await upsertProfile(dbtx, {
      userId: authUser.id,
      displayName: sessionEmail.split("@")[0],
      initials: deriveInitials(sessionEmail),
      accent: deriveAccent(authUser.id),
    });
  });

  await writeActiveGroupId(invite.groupId);
  return { groupId: invite.groupId };
}

export async function revokeInvitation(input: { invitationId: string }): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");

  const invite = await getById(input.invitationId);
  if (!invite) throw new NotFoundError("Invitation not found");

  if ((await getRole(user.id, invite.groupId)) !== "owner") {
    throw new ForbiddenError("Only an owner can revoke invites");
  }
  await markRevoked(input.invitationId);
}
