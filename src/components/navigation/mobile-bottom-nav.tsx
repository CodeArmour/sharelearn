import { PRIMARY_NAV } from "@/lib/config/navigation";

import { AddKnowledgeFab } from "./add-knowledge-button";
import { NavItem } from "./nav-item";

/**
 * Mobile bottom navigation — fixed bar, shown below `lg`. Four primary
 * destinations with a raised central capture FAB. Maps to the Figma `TabBar`.
 */
export function MobileBottomNav() {
  const [today, library, practice, exam] = PRIMARY_NAV;
  const leading = [today, library];
  const trailing = [practice, exam];

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="relative mx-auto flex h-[72px] max-w-md items-center justify-between px-3">
        {leading.map((item) => {
          const Icon = item.icon;
          return (
            <NavItem
              key={item.key}
              navKey={item.key}
              href={item.href}
              label={item.label}
              platform="mobile"
              icon={<Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />}
            />
          );
        })}

        <div className="w-14 shrink-0" aria-hidden />

        {trailing.map((item) => {
          const Icon = item.icon;
          return (
            <NavItem
              key={item.key}
              navKey={item.key}
              href={item.href}
              label={item.label}
              platform="mobile"
              icon={<Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />}
            />
          );
        })}

        <div className="absolute -top-5 left-1/2 -translate-x-1/2">
          <AddKnowledgeFab />
        </div>
      </div>
    </nav>
  );
}
