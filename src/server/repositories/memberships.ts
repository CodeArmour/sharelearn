import "server-only";

import { and, eq } from "drizzle-orm";

import { db, type Db } from "@/server/db/client";
import {
  groupMemberships,
  profiles,
  type GroupMembership,
} from "@/server/db/schema";
import type { GroupMemberSummary, GroupRole } from "@/types";

export async function createMembership(
  tx: Db,
  m: { groupId: string; userId: string; role: GroupRole },
): Promise<GroupMembership> {
  const [row] = await tx.insert(groupMemberships).values(m).returning();
  return row;
}

export async function listMembers(groupId: string): Promise<GroupMemberSummary[]> {
  const rows = await db
    .select({
      id: groupMemberships.userId,
      role: groupMemberships.role,
      joinedAt: groupMemberships.createdAt,
      name: profiles.displayName,
      initials: profiles.initials,
      accent: profiles.accent,
    })
    .from(groupMemberships)
    .innerJoin(profiles, eq(profiles.id, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials,
    accent: r.accent as GroupMemberSummary["accent"],
    avatarUrl: null,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
  }));
}

export async function getRole(userId: string, groupId: string): Promise<GroupRole | null> {
  const [row] = await db
    .select({ role: groupMemberships.role })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.groupId, groupId)))
    .limit(1);
  return row?.role ?? null;
}
