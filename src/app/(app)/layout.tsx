import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout";
import { getLibraryStats } from "@/server/services/knowledge-service";
import { ActiveGroupProvider } from "@/lib/active-group";
import { resolveActiveContext } from "@/server/services/session-service";

/** Authenticated application layout. Resolves the active group (or redirects)
 * before rendering the persistent shell. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await resolveActiveContext();
  if (ctx.status === "needs-login") redirect("/login");
  if (ctx.status === "needs-group" || ctx.status === "no-access") redirect("/groups");

  const stats = await getLibraryStats();
  return (
    <ActiveGroupProvider
      value={{ user: ctx.user, group: ctx.activeGroup, membership: ctx.membership }}
    >
      <AppShell libraryCount={stats.total}>{children}</AppShell>
    </ActiveGroupProvider>
  );
}
