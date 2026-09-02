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
 * and the mobile bottom bar so the two stay in sync.
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

export interface NavItem {
  key: string;
  /** Dutch label shown in the UI. */
  label: string;
  href: AppHref;
  icon: LucideIcon;
  /** Optional count badge (e.g. library size). */
  badgeKey?: "libraryCount";
}

/** Primary destinations — sidebar list on desktop, bottom bar on mobile. */
export const PRIMARY_NAV: NavItem[] = [
  { key: "today", label: "Vandaag", href: "/today", icon: Home },
  {
    key: "library",
    label: "Bibliotheek",
    href: "/library",
    icon: Library,
    badgeKey: "libraryCount",
  },
  { key: "practice", label: "Oefenen", href: "/practice", icon: Target },
  { key: "exam", label: "Examen", href: "/exam", icon: ClipboardList },
];

/** Secondary destinations — bottom of the desktop sidebar / the mobile menu. */
export const SECONDARY_NAV: NavItem[] = [
  { key: "profile", label: "Profiel", href: "/profile", icon: User },
  { key: "group", label: "Groep", href: "/settings/group", icon: Users },
  { key: "logout", label: "Uitloggen", href: "/foundation", icon: LogOut },
];

/** The "+ Add knowledge" action (its own affordance, not a nav item). */
export const ADD_ACTION = {
  label: "Toevoegen",
  href: "/add" as const,
} satisfies { label: string; href: AppHref };

/** Route → nav key, for computing the active item from `usePathname()`. */
export function activeNavKey(pathname: string): string | null {
  const all = [...PRIMARY_NAV, ...SECONDARY_NAV];
  const match = all.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.key ?? null;
}
