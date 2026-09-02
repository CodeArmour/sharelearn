import type { ReactNode } from "react";

import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";

/**
 * AppShell — the persistent chrome around every authenticated screen.
 *
 * Layout: fixed sidebar rail on `lg+`, fixed bottom bar below `lg`. The content
 * region scrolls independently and reserves space for the mobile bar.
 */
export function AppShell({
  libraryCount,
  children,
}: {
  libraryCount: number;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:shadow-elevated focus:outline-2 focus:outline-border-focus"
      >
        Naar hoofdinhoud
      </a>

      <DesktopSidebar libraryCount={libraryCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="flex-1 pb-24 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
