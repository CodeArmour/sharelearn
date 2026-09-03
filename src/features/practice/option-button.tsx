import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type OptionState = "idle" | "correct" | "wrong" | "muted";

/** One answer choice in a practice question. */
export function OptionButton({
  label,
  state,
  disabled,
  onClick,
}: {
  label: string;
  state: OptionState;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-body transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        state === "idle" &&
          "border-border-default bg-surface hover:border-border-strong hover:bg-surface-interactive",
        state === "correct" && "border-success bg-success-subtle font-medium text-success-strong",
        state === "wrong" && "border-error bg-error-subtle font-medium text-error-strong",
        state === "muted" && "border-border bg-surface text-fg-muted",
      )}
    >
      <span className="flex-1">{label}</span>
      {state === "correct" ? (
        <Check className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
      ) : null}
      {state === "wrong" ? <X className="size-5 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
    </button>
  );
}
