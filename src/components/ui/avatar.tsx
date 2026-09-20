import { cva, type VariantProps } from "class-variance-authority";
import { User } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

import { avatarDataUri } from "@/lib/avatar/micah";
import { cn } from "@/lib/utils/cn";
import type { AvatarConfig } from "@/types";

/**
 * Avatar — the user's DiceBear Micah avatar, generated locally from their saved
 * config and shown as an `<img>` (an SVG loaded as an image cannot run scripts,
 * so no markup is ever injected). Maps to the Figma `Avatar` component (Size
 * xs/sm/md/lg; `xl` is the builder preview). Falls back to a neutral placeholder
 * icon when `avatar` is null (no profile row).
 *
 * Decorative by default (`aria-hidden`): the person's name is expected to sit
 * next to it. Pass an `aria-label` if the avatar stands alone.
 */
const avatarVariants = cva(
  "inline-grid shrink-0 place-items-center overflow-hidden rounded-pill select-none",
  {
    variants: {
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
        xl: "size-20 md:size-32",
      },
    },
    defaultVariants: { size: "xs" },
  },
);

export interface AvatarProps
  extends Omit<ComponentPropsWithRef<"span">, "children">, VariantProps<typeof avatarVariants> {
  avatar: AvatarConfig | null;
}

export function Avatar({ avatar, size, className, "aria-label": ariaLabel, ...props }: AvatarProps) {
  const a11y = {
    role: ariaLabel ? ("img" as const) : undefined,
    "aria-label": ariaLabel,
    "aria-hidden": ariaLabel ? undefined : (true as const),
  };

  if (!avatar) {
    return (
      <span
        className={cn(avatarVariants({ size }), "bg-surface-sunken text-fg-secondary", className)}
        {...a11y}
        {...props}
      >
        <User className="size-[60%]" strokeWidth={1.75} aria-hidden />
      </span>
    );
  }

  return (
    <span className={cn(avatarVariants({ size }), className)} {...a11y} {...props}>
      {/* A local data: URI, so next/image's optimisation does not apply. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarDataUri(avatar)} alt="" draggable={false} className="size-full" />
    </span>
  );
}
