import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Button — maps to the Figma `Button` component set
 * (Variant × Size × State). State (hover / active / disabled) is expressed with
 * CSS rather than variants.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md whitespace-nowrap",
    "font-sans text-button font-semibold",
    "transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "bg-secondary text-fg-secondary hover:bg-secondary-hover active:bg-secondary-active",
        outline:
          "border border-border-default bg-surface text-fg-secondary hover:bg-surface-interactive-hover",
        ghost: "text-fg-secondary hover:bg-surface-interactive-hover",
        danger: "bg-error text-on-primary hover:bg-error-strong",
      },
      size: {
        sm: "h-9 px-3 text-body-sm",
        md: "h-11 px-4",
        lg: "h-12 px-5",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      block: false,
    },
  },
);

export interface ButtonProps
  extends ComponentPropsWithRef<"button">, VariantProps<typeof buttonVariants> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  className,
  variant,
  size,
  block,
  iconLeft,
  iconRight,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {iconLeft ? <span className="-ml-0.5 inline-flex shrink-0">{iconLeft}</span> : null}
      {children}
      {iconRight ? <span className="-mr-0.5 inline-flex shrink-0">{iconRight}</span> : null}
    </button>
  );
}
