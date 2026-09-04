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
  try {
    (await cookies()).set(ACTIVE_GROUP_COOKIE, id, OPTS);
  } catch {
    // Called during a Server Component render (e.g. the (app) layout or the
    // invite page) — cookie writes aren't allowed there. The value is
    // re-resolved per request, so a no-op here is safe.
  }
}
export async function clearActiveGroupId(): Promise<void> {
  try {
    (await cookies()).delete(ACTIVE_GROUP_COOKIE);
  } catch {
    // Same as writeActiveGroupId — no-op during SC render.
  }
}
