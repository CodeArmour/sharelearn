import "server-only";

import { eq } from "drizzle-orm";

import { db, type Db } from "@/server/db/client";
import { profiles, type Profile } from "@/server/db/schema";

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row ?? null;
}

export async function upsertProfile(
  tx: Db,
  p: { userId: string; displayName: string; initials: string; accent: string },
): Promise<Profile> {
  const [row] = await tx
    .insert(profiles)
    .values({ id: p.userId, displayName: p.displayName, initials: p.initials, accent: p.accent })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { displayName: p.displayName, initials: p.initials, accent: p.accent },
    })
    .returning();
  return row;
}
