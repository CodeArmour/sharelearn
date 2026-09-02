import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Text input — the border/focus treatment shared by every form control
 * (`Input`, `Textarea`, `Select`). `aria-invalid` switches on the error ring.
 */
export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-border-default bg-surface px-3 text-body text-fg",
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
