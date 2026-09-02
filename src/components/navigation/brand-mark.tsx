import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils/cn";

/**
 * The "Nederlands" wordmark used at the top of the desktop sidebar.
 * `compact` renders the mark only (for tight spaces).
 */
export async function BrandMark({ compact = false }: { compact?: boolean }) {
  const t = await getTranslations();

  return (
    <Link
      href="/today"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md pl-1",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
      )}
    >
      <span
        aria-hidden
        className="grid size-[30px] place-items-center rounded-md bg-primary font-display text-body font-semibold text-on-primary"
      >
        N
      </span>
      {!compact && (
        <span className="font-display text-title font-medium text-fg">{t("common.appName")}</span>
      )}
      <span className="sr-only">{t("a11y.brandHome")}</span>
    </Link>
  );
}
