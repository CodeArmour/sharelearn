/**
 * Frontend rendering contracts for people. Not a database schema — these are the
 * shapes screens need in order to render attribution, avatars and the group list.
 */

import type { AvatarConfig } from "./avatar";

export type GroupRole = "owner" | "member";

export interface UserSummary {
  id: string;
  name: string;
  /** The user's chosen illustrated avatar, or null if they haven't finished
   * onboarding yet (a groupmate visible in the roster before completing it). */
  avatar: AvatarConfig | null;
  avatarUrl?: string | null;
}

export interface GroupMemberSummary extends UserSummary {
  role: GroupRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}
