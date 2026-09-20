import type { AvatarConfig } from "@/types";

import { defaultAvatarFor } from "./generate";
import { avatarConfigSchema } from "./schema";

/** Tolerant read of a stored avatar. Anything that isn't a valid current-version
 * config — null, the legacy 10-character shape, an unknown version, corrupt
 * JSON — resolves to the user's deterministic default instead of throwing. */
export function resolveAvatar(raw: unknown, userId: string): AvatarConfig {
  const parsed = avatarConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultAvatarFor(userId);
}
