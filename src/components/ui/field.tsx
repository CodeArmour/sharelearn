import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Form-field scaffold: label, control slot, optional hint and error.
 *
 * The caller owns the control's `id` and passes it as `htmlFor`; wire
 * `aria-describedby={`${id}-hint`}` / `aria-invalid` on the control itself when
 * a hint or error is present.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-label font-medium text-fg-secondary">
        {label}
        {required ? (
          <span className="text-error" aria-hidden>
            {" *"}
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-caption text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-caption text-error-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
