import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { groupMemberships, groups, type Group, type GroupMembership } from "@/server/db/schema";
import type { GroupSummary } from "@/types";

export async function listGroupsForUser(userId: string): Promise<GroupSummary[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      role: groupMemberships.role,
    })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(eq(groupMemberships.userId, userId))
    .orderBy(groups.name);
  return rows;
}

export async function getGroupById(id: string): Promise<Group | null> {
  const [row] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
  return row ?? null;
}

export async function getMembership(
  userId: string,
  groupId: string,
): Promise<GroupMembership | null> {
  const [row] = await db
    .select()
    .from(groupMemberships)
    .where(and(eq(groupMemberships.userId, userId), eq(groupMemberships.groupId, groupId)))
    .limit(1);
  return row ?? null;
}
