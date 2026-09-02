import { getTranslations } from "next-intl/server";

import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/config/navigation";

import { AddKnowledgeButton } from "./add-knowledge-button";
import { BrandMark } from "./brand-mark";
import { LocaleToggle } from "./locale-toggle";
import { NavItem } from "./nav-item";

/**
 * Desktop sidebar — fixed 264px rail, full viewport height, hidden below `lg`.
 * Maps to the Figma sidebar (brand → Toevoegen → primary nav → spacer →
 * language → secondary nav).
 */
export async function DesktopSidebar({ libraryCount }: { libraryCount: number }) {
  const t = await getTranslations();

  return (
    <aside className="sticky top-0 hidden h-svh w-[264px] shrink-0 flex-col gap-6 border-r border-border bg-surface p-4 lg:flex">
      <BrandMark />
      <AddKnowledgeButton />

      <nav aria-label={t("a11y.mainNav")}>
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <NavItem
                  navKey={item.key}
                  href={item.href}
                  label={t(`nav.${item.key}`)}
                  platform="desktop"
                  icon={<Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />}
                  badge={item.badgeKey === "libraryCount" ? libraryCount : undefined}
                />
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1" />

      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-caption text-fg-muted">{t("locale.switcherLabel")}</span>
        <LocaleToggle />
      </div>

      <nav aria-label={t("a11y.accountNav")}>
        <ul className="flex flex-col gap-1">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <NavItem
                  navKey={item.key}
                  href={item.href}
                  label={t(`nav.${item.key}`)}
                  platform="desktop"
                  icon={<Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />}
                />
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
