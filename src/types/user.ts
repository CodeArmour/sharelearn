/**
 * Frontend rendering contracts for people. Not a database schema — these are the
 * shapes screens need in order to render attribution, avatars and the group list.
 */

export type GroupRole = "owner" | "member";

export interface UserSummary {
  id: string;
  name: string;
  /** 1–2 letters shown in the circular avatar when there is no image. */
  initials: string;
  /**
   * Knowledge-type token key that tints this person's avatar in the Figma
   * design (keeps the small group visually distinguishable). Optional.
   */
  accent?: "vocabulary" | "grammar" | "reading" | "file";
  avatarUrl?: string | null;
}

export interface GroupMemberSummary extends UserSummary {
  role: GroupRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}
