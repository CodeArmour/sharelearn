import "server-only";

import { writeActiveGroupId } from "@/server/active-group";
import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getMembership, listGroupsForUser } from "@/server/repositories/groups";
import { listPendingForGroup } from "@/server/repositories/invitations";
import { listMembers } from "@/server/repositories/memberships";
import { getProfile } from "@/server/repositories/profiles";
import { resolveActiveContext } from "@/server/services/session-service";
import type { GroupSettingsView, GroupSummary, PendingInvite } from "@/types";

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");
  return user.id;
}

export async function getGroupsForPicker(): Promise<GroupSummary[]> {
  const userId = await requireUserId();
  return listGroupsForUser(userId);
}

export async function switchActiveGroup(groupId: string): Promise<void> {
  const userId = await requireUserId();
  const membership = await getMembership(userId, groupId);
  if (!membership) throw new ForbiddenError("Not a member of that group");
  await writeActiveGroupId(groupId);
}

export async function getGroupSettings(): Promise<GroupSettingsView> {
  // Re-derive the active group the same self-healing way (app)/layout does,
  // rather than trusting the cookie alone: a single-membership auto-select
  // never persists the cookie when resolved during a render (Next forbids
  // cookie writes there), so a raw cookie read would 404 every time.
  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") throw new NotFoundError("No active group");
  const { activeGroup, membership } = ctx;

  const members = await listMembers(activeGroup.id);

  let pendingInvites: PendingInvite[] = [];
  if (membership.role === "owner") {
    const rows = await listPendingForGroup(activeGroup.id);
    pendingInvites = await Promise.all(
      rows.map(async (r) => {
        const inviter = await getProfile(r.invitedBy);
        return {
          id: r.id,
          email: r.email,
          role: r.role,
          invitedByName: inviter?.displayName ?? "—",
          expiresAt: r.expiresAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        };
      }),
    );
  }

  return {
    group: activeGroup,
    members,
    pendingInvites,
    viewerRole: membership.role,
  };
}
