import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

/**
 * A "… van vandaag" grouping: heading + "N nieuw" count + its cards.
 * Heading is Heading 3 on mobile, Heading 2 from `lg` (matches Figma).
 */
export async function TodaySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const t = await getTranslations("today");

  return (
    <section className="flex flex-col gap-3 lg:gap-4">
      <div className="flex items-center gap-2 lg:gap-2.5">
        <h2 className="font-display text-h3 text-fg lg:text-h2">{title}</h2>
        {count > 0 ? (
          <Badge tone="info" size="sm">
            {t("newCount", { count })}
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  );
}
