import type { GroupMemberSummary, GroupRole, UserSummary } from "./user";

export interface GroupSummary {
  id: string;
  name: string;
  slug: string;
  role: GroupRole;
}

export interface ActiveGroup {
  id: string;
  name: string;
  slug: string;
}

export interface Membership {
  groupId: string;
  userId: string;
  role: GroupRole;
}

export type ActiveContext =
  | { status: "ok"; user: UserSummary; activeGroup: ActiveGroup; membership: Membership }
  | { status: "needs-login" }
  | { status: "needs-group" }
  | { status: "no-access" };

export interface PendingInvite {
  id: string;
  email: string;
  role: GroupRole;
  invitedByName: string;
  /** ISO 8601. */
  expiresAt: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface GroupSettingsView {
  group: ActiveGroup;
  members: GroupMemberSummary[];
  pendingInvites: PendingInvite[];
  viewerRole: GroupRole;
}

export type InviteErrorCode =
  | "expired"
  | "revoked"
  | "email-mismatch"
  | "already-member"
  | "not-found";
