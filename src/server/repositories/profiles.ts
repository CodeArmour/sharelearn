import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db, type Db } from "@/server/db/client";
import { profiles, type Profile } from "@/server/db/schema";
import type { ProfileFields } from "@/types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row ?? null;
}

/** Seeds the placeholder profile row created alongside a membership at
 * invite-accept time — overwritten once the user completes onboarding. */
export async function upsertProfile(
  tx: Db,
  p: { userId: string; fullName: string; nickname: string },
): Promise<Profile> {
  const [row] = await tx
    .insert(profiles)
    .values({ id: p.userId, fullName: p.fullName, nickname: p.nickname })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { fullName: p.fullName, nickname: p.nickname },
    })
    .returning();
  return row;
}

export async function updateProfile(userId: string, fields: ProfileFields): Promise<Profile | undefined> {
  const [row] = await db
    .update(profiles)
    .set({
      fullName: fields.fullName,
      nickname: fields.nickname,
      avatar: fields.avatar,
      cefrLevel: fields.cefrLevel,
      learningGoal: fields.learningGoal,
    })
    .where(eq(profiles.id, userId))
    .returning();
  return row;
}

/** Idempotent: only ever sets `onboardedAt` the first time, so re-submitting
 * onboarding — or later editing from /profile, which never calls this —
 * can't reset it. */
export async function markOnboarded(userId: string): Promise<void> {
  await db
    .update(profiles)
    .set({ onboardedAt: new Date() })
    .where(and(eq(profiles.id, userId), isNull(profiles.onboardedAt)));
}
