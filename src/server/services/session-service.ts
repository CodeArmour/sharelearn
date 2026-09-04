import "server-only";

import { cache } from "react";

import { clearActiveGroupId, readActiveGroupId, writeActiveGroupId } from "@/server/active-group";
import { getCurrentUser } from "@/server/auth/session";
import { listGroupsForUser } from "@/server/repositories/groups";
import type { ActiveContext } from "@/types";

/** Memoized per-request via React's `cache()` (App Router semantics): every
 * call within the same render/request reuses the first result instead of
 * repeating the auth round-trip + DB query + cookie reads. */
export const resolveActiveContext = cache(async (): Promise<ActiveContext> => {
  const user = await getCurrentUser();
  if (!user) return { status: "needs-login" };

  const groups = await listGroupsForUser(user.id);
  if (groups.length === 0) return { status: "no-access" };

  const cookieId = await readActiveGroupId();
  let active = cookieId ? groups.find((g) => g.id === cookieId) : undefined;

  if (cookieId && !active) await clearActiveGroupId();

  if (!active) {
    if (groups.length === 1) {
      active = groups[0];
      await writeActiveGroupId(active.id);
    } else {
      return { status: "needs-group" };
    }
  }

  return {
    status: "ok",
    user,
    activeGroup: { id: active.id, name: active.name, slug: active.slug },
    membership: { groupId: active.id, userId: user.id, role: active.role },
  };
});
