import Link from "next/link";
import { LayoutGrid, Rows3 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils/cn";

/**
 * Cards / Table view switcher. Desktop only — below `lg` the Library always
 * shows cards. State lives in the URL (`?view=`). Maps to the Figma
 * `LibraryViewToggle`.
 */
export async function LibraryViewToggle({
  view,
  hrefFor,
}: {
  view: "cards" | "table";
  hrefFor: (view: "cards" | "table") => string;
}) {
  const t = await getTranslations("library.view");
  const items = [
    { key: "cards" as const, label: t("cards"), Icon: LayoutGrid },
    { key: "table" as const, label: t("table"), Icon: Rows3 },
  ];

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="hidden gap-0.5 rounded-md bg-surface-sunken p-0.5 lg:inline-flex"
    >
      {items.map(({ key, label, Icon }) => {
        const active = key === view;
        return (
          <Link
            key={key}
            href={hrefFor(key)}
            scroll={false}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-label font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
              active ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
