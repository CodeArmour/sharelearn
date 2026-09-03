import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db, type Db } from "@/server/db/client";
import { invitations, type Invitation } from "@/server/db/schema";
import type { GroupRole } from "@/types";

export async function createInvitation(
  tx: Db,
  i: {
    groupId: string;
    email: string;
    token: string;
    role: GroupRole;
    invitedBy: string;
    expiresAt: Date;
  },
): Promise<Invitation> {
  const [row] = await tx.insert(invitations).values(i).returning();
  return row;
}

export async function getByToken(token: string): Promise<Invitation | null> {
  const [row] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return row ?? null;
}

export async function getPendingByEmail(email: string): Promise<Invitation[]> {
  return db
    .select()
    .from(invitations)
    .where(and(eq(invitations.email, email), eq(invitations.status, "pending")));
}

export async function listPendingForGroup(groupId: string): Promise<Invitation[]> {
  return db
    .select()
    .from(invitations)
    .where(and(eq(invitations.groupId, groupId), eq(invitations.status, "pending")))
    .orderBy(invitations.createdAt);
}

export async function markAccepted(tx: Db, id: string): Promise<void> {
  await tx
    .update(invitations)
    .set({ status: "accepted", acceptedAt: sql`now()` })
    .where(eq(invitations.id, id));
}

export async function markRevoked(id: string): Promise<void> {
  await db.update(invitations).set({ status: "revoked" }).where(eq(invitations.id, id));
}
