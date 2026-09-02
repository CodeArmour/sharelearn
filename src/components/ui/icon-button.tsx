import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * IconButton — a square, icon-only control. An accessible name is required:
 * pass `aria-label` (or `aria-labelledby`). Enforced at the type level.
 */
const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-md",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
    "[&_svg]:size-[1.25em]",
  ],
  {
    variants: {
      variant: {
        ghost: "text-fg-muted hover:bg-surface-interactive-hover hover:text-fg",
        secondary: "bg-secondary text-fg-secondary hover:bg-secondary-hover",
      },
      size: {
        sm: "size-8 text-body-sm",
        md: "size-10 text-body",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

type IconButtonBaseProps = Omit<ComponentPropsWithRef<"button">, "children"> &
  VariantProps<typeof iconButtonVariants> & {
    icon: ReactNode;
  };

export type IconButtonProps = IconButtonBaseProps &
  ({ "aria-label": string } | { "aria-labelledby": string });

export function IconButton({
  className,
  variant,
  size,
  icon,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button type={type} className={cn(iconButtonVariants({ variant, size }), className)} {...props}>
      {icon}
    </button>
  );
}
