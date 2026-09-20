"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/utils/cn";

export interface AvatarOption<Id extends string> {
  id: Id;
  /** Accessible name — always the translated label, never shown as text. */
  label: string;
  /** Visual content for a `tile` (a thumbnail avatar or an icon). */
  content?: ReactNode;
  /** Fill for a `swatch` (a palette hex). */
  color?: string;
}

/**
 * One row of avatar choices: a labelled group of visually-hidden native radio
 * inputs. The platform provides the tab stop, arrow-key navigation and checked
 * state; the styled tile beside each input shows selected / hover / keyboard-focus.
 * Hover and press motion only run under `motion-safe`.
 */
export function AvatarOptionGroup<Id extends string>({
  legend,
  options,
  value,
  onChange,
  variant,
}: {
  legend: string;
  options: readonly AvatarOption<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  variant: "tile" | "swatch";
}) {
  const name = useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-label font-medium text-fg-secondary">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label key={option.id} className="relative cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "grid place-items-center overflow-hidden rounded-pill border-2 border-border bg-surface-sunken",
                  "transition-[transform,box-shadow,border-color] duration-150",
                  "hover:shadow-card motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95",
                  "peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/25",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-focus",
                  variant === "tile" ? "size-14 sm:size-16" : "size-9 sm:size-10",
                )}
                style={option.color ? { backgroundColor: option.color } : undefined}
              >
                {option.content}
              </span>
              {checked ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-pill bg-primary text-on-primary shadow-card"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : null}
              <VisuallyHidden>{option.label}</VisuallyHidden>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
