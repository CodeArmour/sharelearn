import { AvatarCharacterBase } from "./avatar-character-base";

export function GirlOne({ className }: { className?: string }) {
  // Long straight hair framing the face and shoulders, plus a short fringe.
  return (
    <AvatarCharacterBase
      className={className}
      hairBack={<rect x="10" y="9" width="28" height="27" rx="14" fill="var(--avatar-hair)" />}
      hairFront={<ellipse cx="24" cy="11" rx="11" ry="4" fill="var(--avatar-hair)" />}
    />
  );
}

export function GirlTwo({ className }: { className?: string }) {
  // Pigtails poking out to either side, plus a short fringe.
  return (
    <AvatarCharacterBase
      className={className}
      hairBack={
        <>
          <circle cx="10" cy="22" r="6" fill="var(--avatar-hair)" />
          <circle cx="38" cy="22" r="6" fill="var(--avatar-hair)" />
        </>
      }
      hairFront={<ellipse cx="24" cy="11" rx="11" ry="4" fill="var(--avatar-hair)" />}
    />
  );
}

export function GirlThree({ className }: { className?: string }) {
  // A top bun plus a short cap.
  return (
    <AvatarCharacterBase
      className={className}
      hairFront={
        <>
          <circle cx="24" cy="7" r="5" fill="var(--avatar-hair)" />
          <ellipse cx="24" cy="13" rx="11" ry="5" fill="var(--avatar-hair)" />
        </>
      }
    />
  );
}

export function GirlFour({ className }: { className?: string }) {
  // A bob: hair mass hugging just past the head, plus a short fringe.
  return (
    <AvatarCharacterBase
      className={className}
      hairBack={<rect x="11" y="9" width="26" height="18" rx="13" fill="var(--avatar-hair)" />}
      hairFront={<ellipse cx="24" cy="11" rx="11" ry="4" fill="var(--avatar-hair)" />}
    />
  );
}

export function GirlFive({ className }: { className?: string }) {
  // A side ponytail, plus a short cap.
  return (
    <AvatarCharacterBase
      className={className}
      hairBack={<ellipse cx="36" cy="26" rx="5" ry="9" fill="var(--avatar-hair)" />}
      hairFront={<ellipse cx="24" cy="12" rx="11" ry="6" fill="var(--avatar-hair)" />}
    />
  );
}
