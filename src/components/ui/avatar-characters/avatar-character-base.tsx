import type { ReactNode } from "react";

/**
 * Shared frame every avatar character draws on: a tinted background circle,
 * a shirt/shoulders shape, the skin-toned head, and two hair slots so a
 * character can layer hair mass behind the head (long styles, buns,
 * pigtails) and/or a cap over the top of it (short styles, fringes). Colors
 * come from the CSS custom properties `Avatar` sets (--avatar-bg/-hair/
 * -shirt/-skin) — this file has no per-character color logic.
 */
export function AvatarCharacterBase({
  hairBack,
  hairFront,
  className,
}: {
  hairBack?: ReactNode;
  hairFront?: ReactNode;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <circle cx="24" cy="24" r="24" fill="var(--avatar-bg)" />
      {hairBack}
      <path d="M8 44v-2c0-9.9 7.2-18 16-18s16 8.1 16 18v2H8z" fill="var(--avatar-shirt)" />
      <circle cx="24" cy="19" r="11" fill="var(--avatar-skin)" />
      {hairFront}
    </svg>
  );
}
