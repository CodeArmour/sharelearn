import "server-only";

import { readActiveGroupId, writeActiveGroupId } from "@/server/active-group";
import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getGroupById, getMembership, listGroupsForUser } from "@/server/repositories/groups";
import { listPendingForGroup } from "@/server/repositories/invitations";
import { getRole, listMembers } from "@/server/repositories/memberships";
import { getProfile } from "@/server/repositories/profiles";
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
  const userId = await requireUserId();
  const groupId = await readActiveGroupId();
  if (!groupId) throw new NotFoundError("No active group");

  const [group, role, members] = await Promise.all([
    getGroupById(groupId),
    getRole(userId, groupId),
    listMembers(groupId),
  ]);
  if (!group || !role) throw new NotFoundError("Group not found");

  let pendingInvites: PendingInvite[] = [];
  if (role === "owner") {
    const rows = await listPendingForGroup(groupId);
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
    group: { id: group.id, name: group.name, slug: group.slug },
    members,
    pendingInvites,
    viewerRole: role,
  };
}
