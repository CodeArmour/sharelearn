import {
  ClipboardList,
  Home,
  Library,
  type LucideIcon,
  LogOut,
  Target,
  User,
  Users,
} from "lucide-react";

/**
 * Application navigation model. Single source of truth for the desktop sidebar
 * and the mobile bottom bar. Labels are not stored here — each item's `key` is
 * also its translation key in the `nav` message namespace.
 */

/** Routes the app links to internally. Keep in step with `src/app/(app)`. */
export type AppHref =
  | "/today"
  | "/library"
  | "/practice"
  | "/exam"
  | "/add"
  | "/profile"
  | "/settings/group"
  | "/foundation";

export type NavKey = "today" | "library" | "practice" | "exam" | "profile" | "group" | "logout";

export interface NavItem {
  /** Also the `nav.<key>` translation key. */
  key: NavKey;
  href: AppHref;
  icon: LucideIcon;
  /** Optional count badge (e.g. library size). */
  badgeKey?: "libraryCount";
}

/** Primary destinations — sidebar list on desktop, bottom bar on mobile. */
export const PRIMARY_NAV: NavItem[] = [
  { key: "today", href: "/today", icon: Home },
  { key: "library", href: "/library", icon: Library, badgeKey: "libraryCount" },
  { key: "practice", href: "/practice", icon: Target },
  { key: "exam", href: "/exam", icon: ClipboardList },
];

/** Secondary destinations — bottom of the desktop sidebar / the mobile menu. */
export const SECONDARY_NAV: NavItem[] = [
  { key: "profile", href: "/profile", icon: User },
  { key: "group", href: "/settings/group", icon: Users },
  { key: "logout", href: "/foundation", icon: LogOut },
];

/** The "+ Add knowledge" action (its own affordance, not a nav item). */
export const ADD_ACTION = { href: "/add" as const };

/** Route → nav key, for computing the active item from `usePathname()`. */
export function activeNavKey(pathname: string): NavKey | null {
  const all = [...PRIMARY_NAV, ...SECONDARY_NAV];
  const match = all.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.key ?? null;
}
