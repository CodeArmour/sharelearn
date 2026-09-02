import type { ComponentPropsWithRef } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Native `<select>` with the shared form-control styling and a custom chevron.
 * Pass `<option>`s as children.
 */
export function Select({ className, children, ...props }: ComponentPropsWithRef<"select">) {
  return (
    <span className="relative block">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-border-default bg-surface pr-10 pl-3",
          "text-body text-fg",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-error aria-invalid:focus-visible:outline-error",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
        strokeWidth={1.75}
        aria-hidden
      />
    </span>
  );
}
