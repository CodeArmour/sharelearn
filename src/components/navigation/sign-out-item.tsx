"use client";

import type { ReactNode } from "react";

import { signOut } from "@/server/actions/auth";
import { cn } from "@/lib/utils/cn";

/** Renders in the account nav where a NavItem would sit, but submits the
 * `signOut` server action instead of navigating. */
export function SignOutItem({
  label,
  icon,
  platform,
}: {
  label: string;
  icon: ReactNode;
  platform: "desktop" | "compact";
}) {
  if (platform === "compact") {
    return (
      <form action={signOut}>
        <button
          type="submit"
          aria-label={label}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:text-fg",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
          )}
        >
          {icon}
        </button>
      </form>
    );
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-md px-3 text-[0.9375rem] text-fg-secondary transition-colors",
          "hover:bg-surface-interactive-hover",
        )}
      >
        {icon}
        <span className="flex-1 truncate text-left">{label}</span>
      </button>
    </form>
  );
}
