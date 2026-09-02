import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface SectionProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block of page content. */
export function Section({ title, description, actions, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-0.5">
            {title ? <h2 className="font-display text-h3 text-fg">{title}</h2> : null}
            {description ? <p className="text-body-sm text-fg-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
