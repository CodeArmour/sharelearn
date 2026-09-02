import { getTranslations } from "next-intl/server";

import { PRIMARY_NAV } from "@/lib/config/navigation";

import { AddKnowledgeFab } from "./add-knowledge-button";
import { NavItem } from "./nav-item";

/**
 * Mobile bottom navigation — fixed bar, shown below `lg`. Four primary
 * destinations with a raised central capture FAB. Maps to the Figma `TabBar`.
 */
export async function MobileBottomNav() {
  const t = await getTranslations();
  const [today, library, practice, exam] = PRIMARY_NAV;
  const leading = [today, library];
  const trailing = [practice, exam];

  const item = (nav: (typeof PRIMARY_NAV)[number]) => {
    const Icon = nav.icon;
    return (
      <NavItem
        key={nav.key}
        navKey={nav.key}
        href={nav.href}
        label={t(`nav.${nav.key}`)}
        platform="mobile"
        icon={<Icon className="size-[22px]" strokeWidth={1.75} aria-hidden />}
      />
    );
  };

  return (
    <nav
      aria-label={t("a11y.mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="relative mx-auto flex h-[72px] max-w-md items-center justify-between px-3">
        {leading.map(item)}
        <div className="w-14 shrink-0" aria-hidden />
        {trailing.map(item)}

        <div className="absolute -top-5 left-1/2 -translate-x-1/2">
          <AddKnowledgeFab />
        </div>
      </div>
    </nav>
  );
}
