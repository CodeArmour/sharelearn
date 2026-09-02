import type { ReactNode } from "react";

import type { UserSummary } from "@/types";
import { formatDutchDateShort } from "@/lib/utils/date";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";

/**
 * MetaRow — "Toegevoegd door {naam} · {datum}" attribution line, with an
 * optional source chip. Maps to the Figma `MetaRow` component.
 */
export function MetaRow({
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
  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-body-sm", className)}>
      <Avatar initials={addedBy.initials} accent={addedBy.accent} size="xs" />
      <span className="truncate font-medium text-fg-secondary">Toegevoegd door {addedBy.name}</span>
      <span className="shrink-0 text-fg-muted" aria-hidden>
        ·
      </span>
      <time dateTime={date} className="shrink-0 text-fg-muted">
        {formatDutchDateShort(date)}
      </time>
      {source ? (
        <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-pill bg-knowledge-file-subtle px-2 py-0.5 text-caption text-knowledge-file-strong">
          {source.icon}
          {source.label}
        </span>
      ) : null}
    </div>
  );
}
