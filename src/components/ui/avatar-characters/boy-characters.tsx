import { AvatarCharacterBase } from "./avatar-character-base";

export function BoyOne({ className }: { className?: string }) {
  // Buzzcut: a thin strip along the hairline.
  return (
    <AvatarCharacterBase
      className={className}
      hairFront={<ellipse cx="24" cy="11" rx="11" ry="4" fill="var(--avatar-hair)" />}
    />
  );
}

export function BoyTwo({ className }: { className?: string }) {
  // Short crop: a fuller cap over the top of the head.
  return (
    <AvatarCharacterBase
      className={className}
      hairFront={<ellipse cx="24" cy="13" rx="11" ry="6" fill="var(--avatar-hair)" />}
    />
  );
}

export function BoyThree({ className }: { className?: string }) {
  // Side part: a short crop with a skin-colored notch cut into one side.
  return (
    <AvatarCharacterBase
      className={className}
      hairFront={
        <>
          <ellipse cx="24" cy="13" rx="11" ry="6" fill="var(--avatar-hair)" />
          <rect x="29" y="8" width="6" height="6" rx="2" fill="var(--avatar-skin)" />
        </>
      }
    />
  );
}

export function BoyFour({ className }: { className?: string }) {
  // Curly top: a cluster of small circles across the hairline.
  return (
    <AvatarCharacterBase
      className={className}
      hairFront={
        <>
          <circle cx="16" cy="12" r="4" fill="var(--avatar-hair)" />
          <circle cx="22" cy="9" r="4.5" fill="var(--avatar-hair)" />
          <circle cx="28" cy="10" r="4.5" fill="var(--avatar-hair)" />
          <circle cx="33" cy="14" r="4" fill="var(--avatar-hair)" />
        </>
      }
    />
  );
}

export function BoyFive({ className }: { className?: string }) {
  // Spiky quiff: a zigzag along the hairline.
  return (
    <AvatarCharacterBase
      className={className}
      hairFront={<polygon points="14,14 17,7 20,14 24,6 28,14 31,7 34,14" fill="var(--avatar-hair)" />}
    />
  );
}
