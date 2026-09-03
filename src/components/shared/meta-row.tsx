import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import type { UserSummary } from "@/types";
import { formatDateShort } from "@/lib/utils/date";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";

/**
 * MetaRow — "Toegevoegd door {naam} · {datum}" attribution line, with an
 * optional source chip. Maps to the Figma `MetaRow` component.
 */
export async function MetaRow({
  addedBy,
  date,
  source,
  className,
}: {
  addedBy: UserSummary;
  /** ISO 8601 timestamp. */
  date: string;
  source?: { icon: ReactNode; label: string };
  className?: string;
}) {
  const t = await getTranslations("knowledge");
  const locale = await getLocale();

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm", className)}
    >
      {/* Keep name · date together; on a narrow row the source chip wraps below. */}
      <span className="flex min-w-0 items-center gap-2">
        <Avatar initials={addedBy.initials} accent={addedBy.accent} size="xs" />
        <span className="truncate font-medium text-fg-secondary">
          {t("addedBy", { name: addedBy.name })}
        </span>
        <span className="shrink-0 text-fg-muted" aria-hidden>
          ·
        </span>
        <time dateTime={date} className="shrink-0 text-fg-muted">
          {formatDateShort(date, locale)}
        </time>
      </span>
      {source ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-knowledge-file-subtle px-2 py-0.5 text-caption text-knowledge-file-strong">
          {source.icon}
          {source.label}
        </span>
      ) : null}
    </div>
  );
}
