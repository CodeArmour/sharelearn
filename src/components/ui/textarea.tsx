import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils/cn";

/** Multi-line text input. Shares the form-control border/focus treatment. */
export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-border-default bg-surface px-3 py-2.5 text-body text-fg",
        "placeholder:text-fg-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-error aria-invalid:focus-visible:outline-error",
        className,
      )}
      {...props}
    />
  );
}
