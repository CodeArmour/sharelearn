import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Right-aligned actions on desktop; wraps under the title on mobile. */
  actions?: ReactNode;
  className?: string;
}

/** Standard page title block. Maps to the Figma `page-header`. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-4 lg:mb-10 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-h1 text-fg lg:text-display">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-body-sm text-fg-muted lg:text-body-lg lg:text-fg-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
