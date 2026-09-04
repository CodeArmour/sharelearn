import { getTranslations } from "next-intl/server";

import { SECONDARY_NAV } from "@/lib/config/navigation";

import { BrandMark } from "./brand-mark";
import { LocaleToggle } from "./locale-toggle";
import { NavItem } from "./nav-item";
import { SignOutItem } from "./sign-out-item";

/**
 * Mobile top bar — sticky, shown below `lg`. Carries the account destinations
 * (Profile, Group, Logout) and the language toggle that sit at the foot of the
 * DesktopSidebar, which is hidden at this width; without it those routes have
 * no entry point on a phone.
 */
export async function MobileTopBar() {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex h-14 items-center">
        <BrandMark compact />
      </div>

      <nav aria-label={t("a11y.accountNav")} className="flex items-center gap-1.5">
        <LocaleToggle />
        {SECONDARY_NAV.map((item) => {
          const Icon = item.icon;
          const icon = <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />;
          return item.key === "logout" ? (
            <SignOutItem
              key={item.key}
              platform="compact"
              label={t(`nav.${item.key}`)}
              icon={icon}
            />
          ) : (
            <NavItem
              key={item.key}
              navKey={item.key}
              href={item.href}
              label={t(`nav.${item.key}`)}
              platform="compact"
              icon={icon}
            />
          );
        })}
      </nav>
    </header>
  );
}
