import { cva, type VariantProps } from "class-variance-authority";
import { User } from "lucide-react";
import type { ComponentPropsWithRef, CSSProperties } from "react";

import { AVATAR_CHARACTER_COMPONENTS } from "@/components/ui/avatar-characters";
import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import { cn } from "@/lib/utils/cn";
import type { AvatarConfig } from "@/types";

/**
 * Avatar — the user's chosen illustrated character, recolored via CSS custom
 * properties. Maps to the Figma `Avatar` component (Size xs/sm/md/lg). Falls
 * back to a neutral placeholder icon when `avatar` is null (a groupmate who
 * hasn't finished onboarding yet).
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
  const Character = avatar ? AVATAR_CHARACTER_COMPONENTS[avatar.character] : undefined;

  if (!avatar || !Character) {
    return (
      <span
        className={cn(avatarVariants({ size }), "bg-surface-sunken text-fg-secondary", className)}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
        {...props}
      >
        <User className="size-[60%]" strokeWidth={1.75} aria-hidden />
      </span>
    );
  }

  const style = {
    "--avatar-bg": BACKGROUND_COLOR_HEX[avatar.backgroundColor],
    "--avatar-hair": HAIR_COLOR_HEX[avatar.hairColor],
    "--avatar-shirt": SHIRT_COLOR_HEX[avatar.shirtColor],
    "--avatar-skin": SKIN_COLOR_HEX[avatar.skinColor],
  } as CSSProperties;

  return (
    <span
      className={cn(avatarVariants({ size }), className)}
      style={style}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      {...props}
    >
      <Character className="size-full" />
    </span>
  );
}
