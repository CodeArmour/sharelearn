"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { activeNavKey, type AppHref } from "@/lib/config/navigation";
import { cn } from "@/lib/utils/cn";

interface NavItemProps {
  navKey: string;
  href: AppHref;
  label: string;
  /** Pre-rendered icon element (kept out of the config so it stays serializable). */
  icon: ReactNode;
  platform: "desktop" | "mobile";
  /** Resolved count badge (desktop only). */
  badge?: number;
}

/**
 * NavigationItem — maps to the Figma component
 * (Platform = Desktop | Mobile, State = Default | Active). Active state is
 * derived from the current pathname; icon colour follows `currentColor`.
 */
export function NavItem({ navKey, href, label, icon, platform, badge }: NavItemProps) {
  const pathname = usePathname();
  const isActive = activeNavKey(pathname) === navKey;

  if (platform === "mobile") {
    return (
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex min-w-[64px] flex-col items-center gap-1 rounded-md py-1.5",
          "text-caption font-medium transition-colors",
          isActive ? "text-link" : "text-fg-muted hover:text-fg",
        )}
      >
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-[0.9375rem] transition-colors",
        isActive
          ? "bg-surface-selected font-medium text-link"
          : "text-fg-secondary hover:bg-surface-interactive-hover",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === "number" && (
        <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5 text-caption font-medium text-fg-muted tabular-nums">
          {badge}
        </span>
      )}
    </Link>
  );
}
