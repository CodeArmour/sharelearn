import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Avatar — initials in a tinted circle. Maps to the Figma `Avatar` component
 * (Size xs/sm/md/lg). The tint uses a knowledge-type accent so the small group
 * stays visually distinguishable; falls back to neutral.
 *
 * Decorative by default (`aria-hidden`): the person's name is expected to sit
 * next to it. Pass an `aria-label` if the avatar stands alone.
 */
const avatarVariants = cva(
  "inline-grid shrink-0 place-items-center rounded-pill font-sans font-semibold uppercase select-none",
  {
    variants: {
      size: {
        xs: "size-6 text-[0.6875rem] leading-4",
        sm: "size-8 text-caption",
        md: "size-10 text-body-sm",
        lg: "size-12 text-body",
      },
    },
    defaultVariants: { size: "xs" },
  },
);

const ACCENT = {
  vocabulary: "bg-knowledge-vocabulary-subtle text-knowledge-vocabulary-strong",
  grammar: "bg-knowledge-grammar-subtle text-knowledge-grammar-strong",
  reading: "bg-knowledge-reading-subtle text-knowledge-reading-strong",
  file: "bg-knowledge-file-subtle text-knowledge-file-strong",
  neutral: "bg-surface-sunken text-fg-secondary",
} as const;

export type AvatarAccent = keyof typeof ACCENT;

export interface AvatarProps
  extends Omit<ComponentPropsWithRef<"span">, "children">, VariantProps<typeof avatarVariants> {
  initials: string;
  accent?: AvatarAccent;
}

export function Avatar({
  initials,
  accent = "neutral",
  size,
  className,
  "aria-label": ariaLabel,
  ...props
}: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size }), ACCENT[accent], className)}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      {...props}
    >
      {initials.slice(0, 2)}
    </span>
  );
}
