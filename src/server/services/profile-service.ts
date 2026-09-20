import "server-only";

import { resolveAvatar } from "@/lib/avatar/resolve";
import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getProfile, markOnboarded, updateProfile } from "@/server/repositories/profiles";
import type { CEFRLevel, LearningGoal, ProfileFields } from "@/types";

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");
  return user.id;
}

export async function getProfileDetails(): Promise<ProfileFields> {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) throw new NotFoundError("Profile not found");
  return {
    fullName: profile.fullName,
    nickname: profile.nickname,
    avatar: resolveAvatar(profile.avatar, userId),
    cefrLevel: profile.cefrLevel as CEFRLevel | null,
    learningGoal: profile.learningGoal as LearningGoal | null,
  };
}

export async function completeOnboarding(fields: ProfileFields): Promise<void> {
  const userId = await requireUserId();
  await updateProfile(userId, fields);
  await markOnboarded(userId);
}

export async function updateProfileDetails(fields: ProfileFields): Promise<void> {
  const userId = await requireUserId();
  await updateProfile(userId, fields);
}
