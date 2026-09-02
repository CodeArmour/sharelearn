import type { GroupMemberSummary, UserSummary } from "@/types";

/**
 * Mock group members. Replace with a `server/repositories/group` call later.
 * The shape returned here is the real `UserSummary` / `GroupMemberSummary`.
 */

export const MOCK_MEMBERS: GroupMemberSummary[] = [
  {
    id: "usr_sofie",
    name: "Sofie",
    initials: "SV",
    accent: "grammar",
    avatarUrl: null,
    role: "owner",
    joinedAt: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "usr_omar",
    name: "Omar",
    initials: "OM",
    accent: "vocabulary",
    avatarUrl: null,
    role: "member",
    joinedAt: "2026-06-03T18:20:00.000Z",
  },
  {
    id: "usr_lena",
    name: "Lena",
    initials: "LE",
    accent: "grammar",
    avatarUrl: null,
    role: "member",
    joinedAt: "2026-06-05T12:00:00.000Z",
  },
];

/** The signed-in user for this mock session. */
export const MOCK_CURRENT_USER: UserSummary = MOCK_MEMBERS[1];

export function memberById(id: string): GroupMemberSummary | undefined {
  return MOCK_MEMBERS.find((m) => m.id === id);
}
