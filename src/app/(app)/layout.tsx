import type { ReactNode } from "react";

import { AppShell } from "@/components/layout";
import { getLibraryStats } from "@/data/mock";

/**
 * Authenticated application layout — wraps every screen in the persistent shell.
 * (Auth enforcement will be added when the auth backend exists.)
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const stats = await getLibraryStats();
  return <AppShell libraryCount={stats.total}>{children}</AppShell>;
}
