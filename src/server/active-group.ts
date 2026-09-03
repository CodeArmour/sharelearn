import "server-only";

import { cookies } from "next/headers";

export const ACTIVE_GROUP_COOKIE = "dutch.active_group";

const OPTS = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

export async function readActiveGroupId(): Promise<string | null> {
  return (await cookies()).get(ACTIVE_GROUP_COOKIE)?.value ?? null;
}
export async function writeActiveGroupId(id: string): Promise<void> {
  (await cookies()).set(ACTIVE_GROUP_COOKIE, id, OPTS);
}
export async function clearActiveGroupId(): Promise<void> {
  (await cookies()).delete(ACTIVE_GROUP_COOKIE);
}
