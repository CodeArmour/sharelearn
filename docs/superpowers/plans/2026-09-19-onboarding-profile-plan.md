# Onboarding & Profile Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mandatory first-sign-in `/onboarding` page collects a user's full name, nickname, a custom recolorable avatar, and optional CEFR level / learning goal; the same data is later editable from `/profile`. The old initials+accent avatar is fully replaced by an illustrated, recolorable character avatar everywhere it appears.

**Architecture:** `profiles` gains `full_name`/`nickname`/`avatar` (jsonb)/`cefr_level`/`learning_goal`/`onboarded_at` and drops `initials`/`accent`. A new `needs-onboarding` status in `resolveActiveContext()` gates every `(app)` route until `onboarded_at` is set. One shared client form (`ProfileForm`, with an `AvatarBuilder` sub-component) submits to two server actions — `completeOnboardingAction` (onboarding, redirects to `/today`) and `updateProfileAction` (editing from `/profile`, no redirect) — both backed by one `profile-service.ts`.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Drizzle ORM/Postgres (Supabase), Zod v4, next-intl, Tailwind + CVA, Vitest + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-19-onboarding-profile-design.md`

## Global Constraints

- Avatar fully replaces the initials+accent `Avatar` everywhere (profile page, group roster, "added by" tags) — `initials`/`accent` columns are dropped, not deprecated-in-place.
- Onboarding is mandatory: every `(app)` route redirects to `/onboarding` until `profiles.onboarded_at` is set. Only `(app)/layout.tsx` needs the guard (see spec's "why no other route needs a guard").
- Within the onboarding form, `fullName`/`nickname`/avatar are required; `cefrLevel`/`learningGoal` are optional and stay optional when editing from `/profile`.
- `updateProfileDetails` (used by `/profile` editing) must never set `onboarded_at`; only `completeOnboarding` (onboarding) does, and only once (idempotent — never resets on a later edit).
- Palette values (skin/hair/shirt/background) are id-based, never raw hex, in both storage and Zod validation.
- Package manager is npm (`package-lock.json`), not pnpm — use `npm run <script>`.
- Gates before considering any task done: `npm run typecheck`, `npm run lint`, `npm test`. Do **not** run `npm run format` / `format:write` on touched files — `format:check` is already red repo-wide (unrelated pre-existing issue); only the three gates above matter here.
- No data backfill needed: the DB was fully reset recently and holds only the admin account, which goes through onboarding like any other user.

---

## Task 1: Shared avatar & profile types

**Files:**
- Create: `src/types/avatar.ts`
- Create: `src/types/profile.ts`
- Modify: `src/types/index.ts`
- Modify: `src/types/user.ts`
- Test: `src/types/avatar.test.ts`

**Interfaces:**
- Produces: `AVATAR_CHARACTERS`, `AvatarCharacterId`, `SKIN_COLORS`, `SkinColorId`, `HAIR_COLORS`, `HairColorId`, `SHIRT_COLORS`, `ShirtColorId`, `BACKGROUND_COLORS`, `BackgroundColorId`, `AvatarConfig`, `DEFAULT_AVATAR` (all from `@/types`); `LEARNING_GOALS`, `LearningGoal`, `ProfileFields` (from `@/types`); `UserSummary.avatar: AvatarConfig | null` and `GroupMemberSummary.avatar: AvatarConfig | null` (replacing `initials`/`accent`).

- [ ] **Step 1: Write the failing test**

```ts
// src/types/avatar.test.ts
import { describe, expect, it } from "vitest";

import {
  AVATAR_CHARACTERS,
  BACKGROUND_COLORS,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
} from "./avatar";

describe("avatar constants", () => {
  it("has 10 characters, 5 girls and 5 boys", () => {
    expect(AVATAR_CHARACTERS).toHaveLength(10);
    expect(AVATAR_CHARACTERS.filter((c) => c.startsWith("girl-"))).toHaveLength(5);
    expect(AVATAR_CHARACTERS.filter((c) => c.startsWith("boy-"))).toHaveLength(5);
  });

  it("has non-empty curated palettes", () => {
    expect(SKIN_COLORS.length).toBeGreaterThan(0);
    expect(HAIR_COLORS.length).toBeGreaterThan(0);
    expect(SHIRT_COLORS.length).toBeGreaterThan(0);
    expect(BACKGROUND_COLORS.length).toBeGreaterThan(0);
  });

  it("DEFAULT_AVATAR picks a value from every palette", () => {
    expect(AVATAR_CHARACTERS).toContain(DEFAULT_AVATAR.character);
    expect(SKIN_COLORS).toContain(DEFAULT_AVATAR.skinColor);
    expect(HAIR_COLORS).toContain(DEFAULT_AVATAR.hairColor);
    expect(SHIRT_COLORS).toContain(DEFAULT_AVATAR.shirtColor);
    expect(BACKGROUND_COLORS).toContain(DEFAULT_AVATAR.backgroundColor);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/avatar.test.ts`
Expected: FAIL — `./avatar` has no exported member (module doesn't exist yet).

- [ ] **Step 3: Create `src/types/avatar.ts`**

```ts
/** Illustrated avatar characters and the curated color palettes a user can
 * recolor them with. Ids are stored (not hex) so the palette can be re-tuned
 * later without a migration — see AvatarConfig. */
export const AVATAR_CHARACTERS = [
  "girl-1",
  "girl-2",
  "girl-3",
  "girl-4",
  "girl-5",
  "boy-1",
  "boy-2",
  "boy-3",
  "boy-4",
  "boy-5",
] as const;
export type AvatarCharacterId = (typeof AVATAR_CHARACTERS)[number];

export const SKIN_COLORS = ["porcelain", "ivory", "tan", "almond", "brown", "deep"] as const;
export type SkinColorId = (typeof SKIN_COLORS)[number];

export const HAIR_COLORS = [
  "black",
  "dark-brown",
  "brown",
  "chestnut",
  "blonde",
  "ginger",
  "gray",
  "pink",
] as const;
export type HairColorId = (typeof HAIR_COLORS)[number];

export const SHIRT_COLORS = [
  "teal",
  "coral",
  "sunflower",
  "sky",
  "grape",
  "mint",
  "slate",
  "rose",
] as const;
export type ShirtColorId = (typeof SHIRT_COLORS)[number];

export const BACKGROUND_COLORS = ["cream", "blush", "mint", "sky", "lilac", "sand"] as const;
export type BackgroundColorId = (typeof BACKGROUND_COLORS)[number];

export interface AvatarConfig {
  character: AvatarCharacterId;
  skinColor: SkinColorId;
  hairColor: HairColorId;
  shirtColor: ShirtColorId;
  backgroundColor: BackgroundColorId;
}

/** A always-valid starting point for the avatar builder and for any profile
 * that predates having a real avatar chosen. */
export const DEFAULT_AVATAR: AvatarConfig = {
  character: AVATAR_CHARACTERS[0],
  skinColor: SKIN_COLORS[0],
  hairColor: HAIR_COLORS[0],
  shirtColor: SHIRT_COLORS[0],
  backgroundColor: BACKGROUND_COLORS[0],
};
```

- [ ] **Step 4: Create `src/types/profile.ts`**

```ts
import type { AvatarConfig } from "./avatar";
import type { CEFRLevel } from "./cefr";

export const LEARNING_GOALS = ["relocating", "work_study", "family", "curious"] as const;
export type LearningGoal = (typeof LEARNING_GOALS)[number];

/** The full set of fields a user fills in during onboarding and can later
 * edit from /profile. */
export interface ProfileFields {
  fullName: string;
  nickname: string;
  avatar: AvatarConfig;
  cefrLevel: CEFRLevel | null;
  learningGoal: LearningGoal | null;
}
```

- [ ] **Step 5: Update the types barrel**

In `src/types/index.ts`, add two lines (alphabetically among the existing `export * from` lines):

```ts
export * from "./avatar";
```
```ts
export * from "./profile";
```

- [ ] **Step 6: Update `UserSummary`/`GroupMemberSummary`**

In `src/types/user.ts`, replace the `initials`/`accent` fields with `avatar`:

```ts
import type { AvatarConfig } from "./avatar";

export type GroupRole = "owner" | "member";

export interface UserSummary {
  id: string;
  name: string;
  /** The user's chosen illustrated avatar, or null if they haven't finished
   * onboarding yet (a groupmate visible in the roster before completing it). */
  avatar: AvatarConfig | null;
  avatarUrl?: string | null;
}

export interface GroupMemberSummary extends UserSummary {
  role: GroupRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/types/avatar.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/types/avatar.ts src/types/profile.ts src/types/avatar.test.ts src/types/index.ts src/types/user.ts
git commit -m "feat(onboarding): add avatar/profile types, replace initials+accent on UserSummary"
```

---

## Task 2: Avatar color palette (hex values)

**Files:**
- Create: `src/lib/avatar-palette.ts`
- Test: `src/lib/avatar-palette.test.ts`

**Interfaces:**
- Consumes: `SkinColorId`, `HairColorId`, `ShirtColorId`, `BackgroundColorId`, `SKIN_COLORS`, `HAIR_COLORS`, `SHIRT_COLORS`, `BACKGROUND_COLORS` (Task 1).
- Produces: `SKIN_COLOR_HEX`, `HAIR_COLOR_HEX`, `SHIRT_COLOR_HEX`, `BACKGROUND_COLOR_HEX` (each `Record<Id, string>`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatar-palette.test.ts
import { describe, expect, it } from "vitest";

import {
  BACKGROUND_COLORS,
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
} from "@/types";

import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "./avatar-palette";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

describe("avatar palette hex maps", () => {
  it("covers every skin/hair/shirt/background id with a valid hex value", () => {
    for (const id of SKIN_COLORS) expect(SKIN_COLOR_HEX[id]).toMatch(HEX_RE);
    for (const id of HAIR_COLORS) expect(HAIR_COLOR_HEX[id]).toMatch(HEX_RE);
    for (const id of SHIRT_COLORS) expect(SHIRT_COLOR_HEX[id]).toMatch(HEX_RE);
    for (const id of BACKGROUND_COLORS) expect(BACKGROUND_COLOR_HEX[id]).toMatch(HEX_RE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/avatar-palette.test.ts`
Expected: FAIL — module `./avatar-palette` not found.

- [ ] **Step 3: Create `src/lib/avatar-palette.ts`**

```ts
import type {
  BackgroundColorId,
  HairColorId,
  ShirtColorId,
  SkinColorId,
} from "@/types";

export const SKIN_COLOR_HEX: Record<SkinColorId, string> = {
  porcelain: "#F7DCC6",
  ivory: "#F0C8A0",
  tan: "#D9A066",
  almond: "#B97B4E",
  brown: "#8A5A3B",
  deep: "#5C3A24",
};

export const HAIR_COLOR_HEX: Record<HairColorId, string> = {
  black: "#2B2118",
  "dark-brown": "#4A3222",
  brown: "#6B4423",
  chestnut: "#8B5A2B",
  blonde: "#D8B26A",
  ginger: "#B5542B",
  gray: "#A9A9A9",
  pink: "#E39BC4",
};

export const SHIRT_COLOR_HEX: Record<ShirtColorId, string> = {
  teal: "#2F9E8F",
  coral: "#E8674A",
  sunflower: "#F2B705",
  sky: "#3E92CC",
  grape: "#7C5CBF",
  mint: "#4FB477",
  slate: "#55637A",
  rose: "#D65D8A",
};

export const BACKGROUND_COLOR_HEX: Record<BackgroundColorId, string> = {
  cream: "#F5EFE6",
  blush: "#F6DDE0",
  mint: "#DFF3EA",
  sky: "#DCEBFA",
  lilac: "#E7DFF6",
  sand: "#EFE3D0",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/avatar-palette.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatar-palette.ts src/lib/avatar-palette.test.ts
git commit -m "feat(onboarding): add avatar palette hex values"
```

---

## Task 3: Avatar character SVGs

**Files:**
- Create: `src/components/ui/avatar-characters/avatar-character-base.tsx`
- Create: `src/components/ui/avatar-characters/girl-characters.tsx`
- Create: `src/components/ui/avatar-characters/boy-characters.tsx`
- Create: `src/components/ui/avatar-characters/index.ts`
- Test: `src/components/ui/avatar-characters/index.test.tsx`

**Interfaces:**
- Consumes: `AvatarCharacterId`, `AVATAR_CHARACTERS` (Task 1).
- Produces: `AVATAR_CHARACTER_COMPONENTS: Record<AvatarCharacterId, ComponentType<{ className?: string }>>`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/avatar-characters/index.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AVATAR_CHARACTERS } from "@/types";

import { AVATAR_CHARACTER_COMPONENTS } from "./index";

describe("AVATAR_CHARACTER_COMPONENTS", () => {
  it("has a component for every character id, each rendering one svg", () => {
    for (const id of AVATAR_CHARACTERS) {
      const Character = AVATAR_CHARACTER_COMPONENTS[id];
      const { container } = render(<Character />);
      expect(container.querySelectorAll("svg")).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/avatar-characters/index.test.tsx`
Expected: FAIL — `./index` not found.

- [ ] **Step 3: Create the shared base frame**

```tsx
// src/components/ui/avatar-characters/avatar-character-base.tsx
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
```

- [ ] **Step 4: Create the 5 girl characters**

```tsx
// src/components/ui/avatar-characters/girl-characters.tsx
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
```

- [ ] **Step 5: Create the 5 boy characters**

```tsx
// src/components/ui/avatar-characters/boy-characters.tsx
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
```

- [ ] **Step 6: Create the registry**

```ts
// src/components/ui/avatar-characters/index.ts
import type { ComponentType } from "react";

import type { AvatarCharacterId } from "@/types";

import { BoyFive, BoyFour, BoyOne, BoyThree, BoyTwo } from "./boy-characters";
import { GirlFive, GirlFour, GirlOne, GirlThree, GirlTwo } from "./girl-characters";

export const AVATAR_CHARACTER_COMPONENTS: Record<
  AvatarCharacterId,
  ComponentType<{ className?: string }>
> = {
  "girl-1": GirlOne,
  "girl-2": GirlTwo,
  "girl-3": GirlThree,
  "girl-4": GirlFour,
  "girl-5": GirlFive,
  "boy-1": BoyOne,
  "boy-2": BoyTwo,
  "boy-3": BoyThree,
  "boy-4": BoyFour,
  "boy-5": BoyFive,
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/components/ui/avatar-characters/index.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/avatar-characters
git commit -m "feat(onboarding): add 10 illustrated avatar characters"
```

---

## Task 4: `profiles` schema migration

**Files:**
- Modify: `src/server/db/schema.ts`
- Create (generated): `src/server/db/migrations/NNNN_*.sql` and matching `meta/` snapshot

**Interfaces:**
- Consumes: `AvatarConfig` (Task 1).
- Produces: `profiles` row shape `{ id, fullName, nickname, avatar: AvatarConfig | null, cefrLevel: string | null, learningGoal: "relocating"|"work_study"|"family"|"curious"|null, onboardedAt: Date | null, createdAt }`. `Profile`/`NewProfile` types (unchanged names, new shape).

- [ ] **Step 1: Edit the `profiles` table in `src/server/db/schema.ts`**

Add `AvatarConfig` to the existing type-only import at the top of the file:

```ts
import type { AvatarConfig, ReadingQuiz } from "@/types";
```

Add a new enum near the other enums (right after `invitationStatus`):

```ts
// Kept in sync with LEARNING_GOALS in src/types/profile.ts.
export const learningGoal = pgEnum("learning_goal", [
  "relocating",
  "work_study",
  "family",
  "curious",
]);
```

Replace the entire `profiles` table definition with:

```ts
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    nickname: text("nickname").notNull(),
    avatar: jsonb("avatar").$type<AvatarConfig>(),
    // Free text + CHECK rather than an enum, same reasoning as `level` on
    // knowledge_items: CEFR_LEVELS shouldn't force an enum migration.
    cefrLevel: text("cefr_level"),
    learningGoal: learningGoal("learning_goal"),
    // Gate signal for onboarding: null means the user hasn't completed it.
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "profiles_cefr_level_values",
      sql`${t.cefrLevel} IS NULL OR ${t.cefrLevel} IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    ),
  ],
);
```

This removes the old `displayName`/`initials`/`accent` fields entirely.

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`

This renames `display_name`→`nickname` (or, if drizzle-kit can't detect the rename non-interactively, drops `display_name` and adds `nickname` — either is fine here, there's no data to preserve), adds `full_name`/`avatar`/`cefr_level`/`learning_goal`/`onboarded_at`, and drops `initials`/`accent`. If it prompts interactively about the rename, confirm it; if it can't prompt in this shell, let it fall through to its non-interactive default.

Open the newly generated file under `src/server/db/migrations/` and confirm it contains (in some form): a `nickname` column ending up present, `full_name`/`avatar`/`cefr_level`/`learning_goal`/`onboarded_at` added, and `initials`/`accent` dropped.

- [ ] **Step 3: Apply the migration**

Run: `npm run db:migrate`

If `SUPABASE_DB_DIRECT_URL` isn't available in this environment, stop after Step 2 and flag it — a human applies the migration before the rest of this plan can be exercised against a live database (the rest of the plan's *code* can still be written and unit-tested without it).

- [ ] **Step 4: Confirm the schema module still compiles on its own**

Run: `npx tsc --noEmit -p . 2>&1 | grep "server/db/schema.ts"`
Expected: no output (schema.ts itself is clean). The overall `npm run typecheck` will still show errors in other files that reference the old `displayName`/`initials`/`accent` fields — that's expected and gets fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/migrations
git commit -m "feat(onboarding): migrate profiles to full_name/nickname/avatar/cefr_level/learning_goal/onboarded_at"
```

---

## Task 5: Data-layer rename (repositories, session, invite, seed)

This is a single mechanical rename propagated through every place that reads or writes a `profiles` row — it can't usefully be split into independently-green sub-steps (Task 4 already put the schema ahead of these files). By the end of this task the whole backend compiles and every existing backend test passes again.

**Files:**
- Modify: `src/server/repositories/profiles.ts`
- Modify: `src/server/repositories/memberships.ts`
- Modify: `src/server/repositories/knowledge.ts`
- Modify: `src/server/auth/session.ts`
- Modify: `src/server/services/invite-service.ts`
- Modify: `src/server/services/group-service.ts`
- Modify: `src/server/db/seed.ts`
- Delete: `src/server/auth/identity.ts`, `src/server/auth/identity.test.ts`
- Modify (test fixtures): `src/server/services/invite-service.test.ts`, `src/server/services/group-service.test.ts`, `src/server/services/session-service.test.ts` (fixture only — the `needs-onboarding` behavior itself is Task 7), `src/server/services/practice-service.test.ts`, `src/server/services/personal-service.test.ts`, `src/server/services/knowledge-service.test.ts`, `src/server/actions/ai.test.ts`, `src/server/repositories/repositories.integration.test.ts`, `src/server/repositories/knowledge.integration.test.ts`

**Interfaces:**
- Consumes: `Profile`/`NewProfile` (Task 4), `AvatarConfig` (Task 1).
- Produces: `upsertProfile(tx, { userId, fullName, nickname }): Promise<Profile>`, `updateProfile(userId, fields: ProfileFields): Promise<Profile>`, `markOnboarded(userId): Promise<void>` (all from `src/server/repositories/profiles.ts` — `updateProfile`/`markOnboarded` are new, consumed by Task 9's `profile-service.ts`).

- [ ] **Step 1: Rewrite `src/server/repositories/profiles.ts`**

```ts
import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db, type Db } from "@/server/db/client";
import { profiles, type Profile } from "@/server/db/schema";
import type { ProfileFields } from "@/types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row ?? null;
}

/** Seeds the placeholder profile row created alongside a membership at
 * invite-accept time — overwritten once the user completes onboarding. */
export async function upsertProfile(
  tx: Db,
  p: { userId: string; fullName: string; nickname: string },
): Promise<Profile> {
  const [row] = await tx
    .insert(profiles)
    .values({ id: p.userId, fullName: p.fullName, nickname: p.nickname })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { fullName: p.fullName, nickname: p.nickname },
    })
    .returning();
  return row;
}

export async function updateProfile(userId: string, fields: ProfileFields): Promise<Profile> {
  const [row] = await db
    .update(profiles)
    .set({
      fullName: fields.fullName,
      nickname: fields.nickname,
      avatar: fields.avatar,
      cefrLevel: fields.cefrLevel,
      learningGoal: fields.learningGoal,
    })
    .where(eq(profiles.id, userId))
    .returning();
  return row;
}

/** Idempotent: only ever sets `onboardedAt` the first time, so re-submitting
 * onboarding — or later editing from /profile, which never calls this —
 * can't reset it. */
export async function markOnboarded(userId: string): Promise<void> {
  await db
    .update(profiles)
    .set({ onboardedAt: new Date() })
    .where(and(eq(profiles.id, userId), isNull(profiles.onboardedAt)));
}
```

- [ ] **Step 2: Update `src/server/repositories/memberships.ts`**

In `listMembers`, change the select and mapping:

```ts
export async function listMembers(groupId: string): Promise<GroupMemberSummary[]> {
  const rows = await db
    .select({
      id: groupMemberships.userId,
      role: groupMemberships.role,
      joinedAt: groupMemberships.createdAt,
      name: profiles.nickname,
      avatar: profiles.avatar,
    })
    .from(groupMemberships)
    .innerJoin(profiles, eq(profiles.id, groupMemberships.userId))
    .where(eq(groupMemberships.groupId, groupId));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    avatarUrl: null,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
  }));
}
```

- [ ] **Step 3: Update `src/server/repositories/knowledge.ts`**

Add `AvatarConfig` to its existing type-only import from `@/types`. Replace `toUserSummary` and the three profile-selecting queries:

```ts
function toUserSummary(p: {
  id: string;
  nickname: string;
  avatar: AvatarConfig | null;
}): UserSummary {
  return {
    id: p.id,
    name: p.nickname,
    avatar: p.avatar,
    avatarUrl: null,
  };
}
```

In `selectWithAttribution`, change the `profile`/`updatedByProfile` select blocks to:

```ts
      profile: {
        id: profiles.id,
        nickname: profiles.nickname,
        avatar: profiles.avatar,
      },
      updatedByProfile: {
        id: updatedByProfiles.id,
        nickname: updatedByProfiles.nickname,
        avatar: updatedByProfiles.avatar,
      },
```

In `insertKnowledgeItem`, change its profile select to:

```ts
  const [profile] = await tx
    .select({
      id: profiles.id,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
    })
    .from(profiles)
    .where(eq(profiles.id, inserted.addedBy))
    .limit(1);
```

- [ ] **Step 4: Update `src/server/auth/session.ts`**

```ts
import "server-only";

import type { Session } from "@supabase/supabase-js";

import { getProfile } from "@/server/repositories/profiles";
import type { UserSummary } from "@/types";

import { createServerSupabaseClient } from "./supabase";

export async function getSession(): Promise<Session | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** The signed-in user as a frontend `UserSummary`, or null if not signed in. */
export async function getCurrentUser(): Promise<UserSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  const profile = await getProfile(authUser.id);
  if (profile) {
    return {
      id: authUser.id,
      name: profile.nickname,
      avatar: profile.avatar,
      avatarUrl: null,
    };
  }
  // Authed but no profile row yet (pre-accept edge case) — derive, don't persist.
  const email = authUser.email ?? "user@unknown";
  return {
    id: authUser.id,
    name: email.split("@")[0],
    avatar: null,
    avatarUrl: null,
  };
}
```

- [ ] **Step 5: Update `src/server/services/invite-service.ts`**

Remove the `import { deriveAccent, deriveInitials } from "@/server/auth/identity";` line. In `acceptInvitation`, change the `upsertProfile` call to:

```ts
    await upsertProfile(dbtx, {
      userId: authUser.id,
      fullName: sessionEmail.split("@")[0],
      nickname: sessionEmail.split("@")[0],
    });
```

- [ ] **Step 6: Update `src/server/services/group-service.ts`**

In `getGroupSettings`, change `invitedByName: inviter?.displayName ?? "—",` to `invitedByName: inviter?.nickname ?? "—",`.

- [ ] **Step 7: Update `src/server/db/seed.ts`**

Remove its `deriveInitials`/`deriveAccent` import and usage; change the profile insert to:

```ts
  await db
    .insert(profiles)
    .values({
      id: userId,
      fullName: email!.split("@")[0],
      nickname: email!.split("@")[0],
    })
    .onConflictDoNothing();
```

- [ ] **Step 8: Delete `src/server/auth/identity.ts` and `src/server/auth/identity.test.ts`**

```bash
git rm src/server/auth/identity.ts src/server/auth/identity.test.ts
```

- [ ] **Step 9: Fix the mechanical `initials`→`avatar` fixtures in existing tests**

In each of these files, replace the `initials: "XX"` property in every `UserSummary`-shaped object literal with `avatar: null` (the `avatarUrl: null` sibling stays as-is):

- `src/server/actions/ai.test.ts` (2 occurrences, lines ~39 and ~106)
- `src/server/services/invite-service.test.ts` (occurrences at ~89 and ~97 in the `OWNER`/`okCtx` fixtures, and ~188 in the `INVITEE` fixture)
- `src/server/services/group-service.test.ts` (line ~31)
- `src/server/services/session-service.test.ts` (line ~22 — the rest of this file's `needs-onboarding` wiring is Task 7)
- `src/server/services/practice-service.test.ts` (line ~14)
- `src/server/services/personal-service.test.ts` (line ~30)
- `src/server/services/knowledge-service.test.ts` (line ~41)

Example (before → after):

```ts
// before
const user = { id: "u1", name: "U", initials: "UU", avatarUrl: null };
// after
const user = { id: "u1", name: "U", avatar: null, avatarUrl: null };
```

- [ ] **Step 10: Fix the two integration-test `upsertProfile` calls**

In `src/server/repositories/repositories.integration.test.ts` and `src/server/repositories/knowledge.integration.test.ts`, change:

```ts
    await profilesRepo.upsertProfile(testDb!, {
      userId: owner,
      displayName: "Owner",
      initials: "OW",
      accent: "vocabulary",
    });
```

to:

```ts
    await profilesRepo.upsertProfile(testDb!, {
      userId: owner,
      fullName: "Owner",
      nickname: "Owner",
    });
```

- [ ] **Step 11: Run the full test suite and typecheck**

Run: `npm run typecheck && npm test`
Expected: Both pass. (Integration tests self-skip without `testDb` env — that's fine; they'll be exercised against a real DB separately if available.)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(onboarding): replace initials/accent with nickname/fullName/avatar across the data layer"
```

---

## Task 6: Avatar component rewrite + UI call sites

**Files:**
- Modify: `src/components/ui/avatar.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `src/features/profile/profile-view.tsx` (avatar prop only — the bigger edit-mode restructure is Task 14)
- Modify: `src/features/group/group-settings-view.tsx`
- Modify: `src/components/shared/meta-row.tsx`
- Test: `src/components/ui/avatar.test.tsx`

**Interfaces:**
- Consumes: `AVATAR_CHARACTER_COMPONENTS` (Task 3), `SKIN_COLOR_HEX`/`HAIR_COLOR_HEX`/`SHIRT_COLOR_HEX`/`BACKGROUND_COLOR_HEX` (Task 2), `AvatarConfig` (Task 1), `UserSummary.avatar`/`GroupMemberSummary.avatar` (Task 1, wired through in Task 5).
- Produces: `Avatar({ avatar: AvatarConfig | null, size?, className?, "aria-label"? })` — the `initials`/`accent` props are gone.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/avatar.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AvatarConfig } from "@/types";

import { Avatar } from "./avatar";

const config: AvatarConfig = {
  character: "girl-1",
  skinColor: "tan",
  hairColor: "black",
  shirtColor: "teal",
  backgroundColor: "cream",
};

describe("Avatar", () => {
  it("sets the CSS custom properties for the chosen palette", () => {
    const { container } = render(<Avatar avatar={config} />);
    const span = container.querySelector("span")!;
    expect(span.style.getPropertyValue("--avatar-skin")).toBe("#D9A066");
    expect(span.style.getPropertyValue("--avatar-hair")).toBe("#2B2118");
    expect(span.style.getPropertyValue("--avatar-shirt")).toBe("#2F9E8F");
    expect(span.style.getPropertyValue("--avatar-bg")).toBe("#F5EFE6");
    expect(container.querySelector('svg[viewBox="0 0 48 48"]')).toBeInTheDocument();
  });

  it("renders a neutral placeholder when avatar is null", () => {
    const { container } = render(<Avatar avatar={null} aria-label="Jamie" />);
    expect(container.querySelector('svg[viewBox="0 0 48 48"]')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-label="Jamie"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/avatar.test.tsx`
Expected: FAIL — current `Avatar` requires `initials`, has no `avatar` prop.

- [ ] **Step 3: Rewrite `src/components/ui/avatar.tsx`**

```tsx
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
  if (!avatar) {
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

  const Character = AVATAR_CHARACTER_COMPONENTS[avatar.character];
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
```

- [ ] **Step 4: Update `src/components/ui/index.ts`**

```ts
export { Avatar, type AvatarProps } from "./avatar";
```

(drops the removed `AvatarAccent` type export)

- [ ] **Step 5: Update the three call sites**

In `src/features/profile/profile-view.tsx`, change `<Avatar initials={user.initials} accent={user.accent} size="lg" />` to `<Avatar avatar={user.avatar} size="lg" />`.

In `src/features/group/group-settings-view.tsx`, change `<Avatar initials={m.initials} accent={m.accent} size="md" />` to `<Avatar avatar={m.avatar} size="md" />`.

In `src/components/shared/meta-row.tsx`, change `<Avatar initials={addedBy.initials} accent={addedBy.accent} size="xs" />` to `<Avatar avatar={addedBy.avatar} size="xs" />`.

- [ ] **Step 6: Run test to verify it passes, then the full gates**

Run: `npx vitest run src/components/ui/avatar.test.tsx`
Expected: PASS

Run: `npm run typecheck && npm run lint && npm test`
Expected: All pass — this is the point where the whole app (backend from Task 5 + UI from this task) is green again.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/avatar.tsx src/components/ui/index.ts src/components/ui/avatar.test.tsx src/features/profile/profile-view.tsx src/features/group/group-settings-view.tsx src/components/shared/meta-row.tsx
git commit -m "feat(onboarding): render the illustrated avatar everywhere initials/accent used to show"
```

---

## Task 7: Onboarding gating (`needs-onboarding`)

**Files:**
- Modify: `src/types/group.ts`
- Modify: `src/server/services/session-service.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/server/services/session-service.test.ts`

**Interfaces:**
- Consumes: `getProfile` (Task 5), `Profile.onboardedAt` (Task 4).
- Produces: `ActiveContext` gains `{ status: "needs-onboarding" }`; `resolveActiveContext()` returns it before resolving a group.

- [ ] **Step 1: Write the failing test**

In `src/server/services/session-service.test.ts`, add a mock for the profiles repository (alongside the existing mocks at the top) and a default in `beforeEach`:

```ts
vi.mock("@/server/repositories/profiles", () => ({
  getProfile: vi.fn(),
}));
```

```ts
import { getProfile } from "@/server/repositories/profiles";
```

```ts
beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
  vi.mocked(getProfile).mockResolvedValue({ onboardedAt: new Date() } as never);
  vi.mocked(readActiveGroupId).mockResolvedValue(null);
  vi.mocked(listGroupsForUser).mockResolvedValue([]);
});
```

Add a new test case:

```ts
  it("needs-onboarding when the profile exists but hasn't been onboarded", async () => {
    vi.mocked(getProfile).mockResolvedValue({ onboardedAt: null } as never);
    expect(await resolveActiveContext()).toEqual({ status: "needs-onboarding" });
    expect(listGroupsForUser).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/session-service.test.ts`
Expected: FAIL — new test fails (status comes back `"no-access"`, not `"needs-onboarding"`), and other tests fail too since `getProfile` isn't mocked/imported yet until this step is in place (this step edits the test file as a whole, so run it once Step 1 is fully applied).

- [ ] **Step 3: Add the status to `ActiveContext`**

In `src/types/group.ts`:

```ts
export type ActiveContext =
  | { status: "ok"; user: UserSummary; activeGroup: ActiveGroup; membership: Membership }
  | { status: "needs-login" }
  | { status: "needs-onboarding" }
  | { status: "needs-group" }
  | { status: "no-access" };
```

- [ ] **Step 4: Update `resolveActiveContext()`**

In `src/server/services/session-service.ts`, add the import and the check right after the `needs-login` check:

```ts
import { getProfile } from "@/server/repositories/profiles";
```

```ts
export const resolveActiveContext = cache(async (): Promise<ActiveContext> => {
  const user = await getCurrentUser();
  if (!user) return { status: "needs-login" };

  const profile = await getProfile(user.id);
  if (profile && !profile.onboardedAt) return { status: "needs-onboarding" };

  const groups = await listGroupsForUser(user.id);
  // ...rest unchanged
```

- [ ] **Step 5: Add the redirect in `(app)/layout.tsx`**

In `src/app/(app)/layout.tsx`:

```ts
  const ctx = await resolveActiveContext();
  if (ctx.status === "needs-login") redirect("/login");
  if (ctx.status === "needs-onboarding") redirect("/onboarding");
  if (ctx.status === "needs-group" || ctx.status === "no-access") redirect("/groups");
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/server/services/session-service.test.ts`
Expected: PASS (all cases, including the pre-existing ones with the new `getProfile` mock defaulted to onboarded)

- [ ] **Step 7: Commit**

```bash
git add src/types/group.ts src/server/services/session-service.ts src/app/\(app\)/layout.tsx src/server/services/session-service.test.ts
git commit -m "feat(onboarding): gate (app) routes on profiles.onboarded_at"
```

---

## Task 8: `profileFieldsSchema` + `LEARNING_GOALS` wiring

**Files:**
- Modify: `src/server/actions/schemas.ts`
- Modify: `src/server/actions/schemas.test.ts`

**Interfaces:**
- Consumes: `AVATAR_CHARACTERS`, `SKIN_COLORS`, `HAIR_COLORS`, `SHIRT_COLORS`, `BACKGROUND_COLORS`, `CEFR_LEVELS`, `LEARNING_GOALS` (Task 1 and existing).
- Produces: `avatarConfigSchema`, `profileFieldsSchema`, `type ProfileFieldsInput` (from `src/server/actions/schemas.ts`).

- [ ] **Step 1: Write the failing test**

Append to `src/server/actions/schemas.test.ts` (importing `profileFieldsSchema` alongside whatever it already imports from `./schemas`):

```ts
import { profileFieldsSchema } from "./schemas";

describe("profileFieldsSchema", () => {
  const avatar = {
    character: "girl-1",
    skinColor: "tan",
    hairColor: "black",
    shirtColor: "teal",
    backgroundColor: "cream",
  };

  it("accepts a complete set of fields", () => {
    const result = profileFieldsSchema.safeParse({
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar,
      cefrLevel: "A2",
      learningGoal: "relocating",
    });
    expect(result.success).toBe(true);
  });

  it("defaults cefrLevel and learningGoal to null when omitted", () => {
    const result = profileFieldsSchema.safeParse({
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar,
    });
    expect(result).toMatchObject({ success: true, data: { cefrLevel: null, learningGoal: null } });
  });

  it("rejects a blank nickname", () => {
    const result = profileFieldsSchema.safeParse({ fullName: "Jamie Vos", nickname: "  ", avatar });
    expect(result.success).toBe(false);
  });

  it("rejects an avatar with an unknown character id", () => {
    const result = profileFieldsSchema.safeParse({
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar: { ...avatar, character: "robot-1" },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/actions/schemas.test.ts`
Expected: FAIL — `profileFieldsSchema` doesn't exist yet.

- [ ] **Step 3: Add the schema**

In `src/server/actions/schemas.ts`, extend the existing import from `@/types`:

```ts
import {
  AVATAR_CHARACTERS,
  BACKGROUND_COLORS,
  CEFR_LEVELS,
  HAIR_COLORS,
  KNOWLEDGE_TYPES,
  LEARNING_GOALS,
  SHIRT_COLORS,
  SKIN_COLORS,
} from "@/types";
```

Add near the bottom of the file:

```ts
export const avatarConfigSchema = z.object({
  character: z.enum(AVATAR_CHARACTERS),
  skinColor: z.enum(SKIN_COLORS),
  hairColor: z.enum(HAIR_COLORS),
  shirtColor: z.enum(SHIRT_COLORS),
  backgroundColor: z.enum(BACKGROUND_COLORS),
});

export const profileFieldsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name"),
  nickname: z.string().trim().min(1, "Enter a nickname"),
  avatar: avatarConfigSchema,
  cefrLevel: z.enum(CEFR_LEVELS).nullable().default(null),
  learningGoal: z.enum(LEARNING_GOALS).nullable().default(null),
});
export type ProfileFieldsInput = z.infer<typeof profileFieldsSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/actions/schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/schemas.ts src/server/actions/schemas.test.ts
git commit -m "feat(onboarding): add profileFieldsSchema validation"
```

---

## Task 9: `profile-service.ts`

**Files:**
- Create: `src/server/services/profile-service.ts`
- Test: `src/server/services/profile-service.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (existing), `getProfile`/`updateProfile`/`markOnboarded` (Task 5), `ProfileFields`/`DEFAULT_AVATAR` (Task 1), `ForbiddenError`/`NotFoundError` (existing `@/server/errors`).
- Produces: `getProfileDetails(): Promise<ProfileFields>`, `completeOnboarding(fields: ProfileFields): Promise<void>`, `updateProfileDetails(fields: ProfileFields): Promise<void>` (consumed by Task 10's server actions and Task 14's `/profile` page).

- [ ] **Step 1: Write the failing test**

```ts
// src/server/services/profile-service.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/repositories/profiles", () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  markOnboarded: vi.fn(),
}));

import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { getProfile, markOnboarded, updateProfile } from "@/server/repositories/profiles";
import { DEFAULT_AVATAR, type ProfileFields } from "@/types";

import { completeOnboarding, getProfileDetails, updateProfileDetails } from "./profile-service";

const fields: ProfileFields = {
  fullName: "Jamie Vos",
  nickname: "Jamie",
  avatar: DEFAULT_AVATAR,
  cefrLevel: "A2",
  learningGoal: "relocating",
};

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", name: "Jamie", avatar: null, avatarUrl: null });
});

describe("completeOnboarding", () => {
  it("saves the fields and marks onboarding complete", async () => {
    await completeOnboarding(fields);
    expect(updateProfile).toHaveBeenCalledWith("u1", fields);
    expect(markOnboarded).toHaveBeenCalledWith("u1");
  });

  it("rejects when signed out", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(completeOnboarding(fields)).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe("updateProfileDetails", () => {
  it("saves the fields without touching onboarding status", async () => {
    await updateProfileDetails(fields);
    expect(updateProfile).toHaveBeenCalledWith("u1", fields);
    expect(markOnboarded).not.toHaveBeenCalled();
  });
});

describe("getProfileDetails", () => {
  it("falls back to the default avatar when none is set", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      id: "u1",
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar: null,
      cefrLevel: null,
      learningGoal: null,
      onboardedAt: new Date(),
      createdAt: new Date(),
    } as never);
    const details = await getProfileDetails();
    expect(details.avatar).toEqual(DEFAULT_AVATAR);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/profile-service.test.ts`
Expected: FAIL — `./profile-service` not found.

- [ ] **Step 3: Create `src/server/services/profile-service.ts`**

```ts
import "server-only";

import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getProfile, markOnboarded, updateProfile } from "@/server/repositories/profiles";
import { DEFAULT_AVATAR, type CEFRLevel, type LearningGoal, type ProfileFields } from "@/types";

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Not signed in");
  return user.id;
}

export async function getProfileDetails(): Promise<ProfileFields> {
  const userId = await requireUserId();
  const profile = await getProfile(userId);
  if (!profile) throw new NotFoundError("Profile not found");
  return {
    fullName: profile.fullName,
    nickname: profile.nickname,
    avatar: profile.avatar ?? DEFAULT_AVATAR,
    cefrLevel: profile.cefrLevel as CEFRLevel | null,
    learningGoal: profile.learningGoal as LearningGoal | null,
  };
}

export async function completeOnboarding(fields: ProfileFields): Promise<void> {
  const userId = await requireUserId();
  await updateProfile(userId, fields);
  await markOnboarded(userId);
}

export async function updateProfileDetails(fields: ProfileFields): Promise<void> {
  const userId = await requireUserId();
  await updateProfile(userId, fields);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/profile-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/profile-service.ts src/server/services/profile-service.test.ts
git commit -m "feat(onboarding): add profile-service (getProfileDetails/completeOnboarding/updateProfileDetails)"
```

---

## Task 10: Server actions

**Files:**
- Create: `src/server/actions/profile.ts`
- Test: `src/server/actions/profile.test.ts`

**Interfaces:**
- Consumes: `profileFieldsSchema` (Task 8), `completeOnboarding`/`updateProfileDetails` (Task 9), `ActionResult`/`toActionError` (existing `./schemas`).
- Produces: `completeOnboardingAction(_prev, formData): Promise<ActionResult<void>>`, `updateProfileAction(_prev, formData): Promise<ActionResult<void>>` (consumed by Task 12's `ProfileForm`). Both read flat `FormData` fields: `fullName`, `nickname`, `character`, `skinColor`, `hairColor`, `shirtColor`, `backgroundColor`, `cefrLevel`, `learningGoal`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/actions/profile.test.ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/profile-service", () => ({
  completeOnboarding: vi.fn(),
  updateProfileDetails: vi.fn(),
}));

import { redirect } from "next/navigation";
import { completeOnboarding, updateProfileDetails } from "@/server/services/profile-service";

import { completeOnboardingAction, updateProfileAction } from "./profile";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validFields = {
  fullName: "Jamie Vos",
  nickname: "Jamie",
  character: "girl-1",
  skinColor: "tan",
  hairColor: "black",
  shirtColor: "teal",
  backgroundColor: "cream",
};

describe("completeOnboardingAction", () => {
  it("redirects to /today on success", async () => {
    await completeOnboardingAction(undefined, formData(validFields));
    expect(completeOnboarding).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/today");
  });

  it("returns a validation error instead of calling the service when the nickname is blank", async () => {
    const result = await completeOnboardingAction(undefined, formData({ ...validFields, nickname: "" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});

describe("updateProfileAction", () => {
  it("saves and returns ok", async () => {
    const result = await updateProfileAction(undefined, formData(validFields));
    expect(updateProfileDetails).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/actions/profile.test.ts`
Expected: FAIL — `./profile` not found.

- [ ] **Step 3: Create `src/server/actions/profile.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { completeOnboarding, updateProfileDetails } from "@/server/services/profile-service";
import type { ProfileFields } from "@/types";

import { profileFieldsSchema, toActionError, type ActionResult } from "./schemas";

function profileFieldsFromFormData(formData: FormData): unknown {
  const cefrLevel = formData.get("cefrLevel");
  const learningGoal = formData.get("learningGoal");
  return {
    fullName: formData.get("fullName"),
    nickname: formData.get("nickname"),
    avatar: {
      character: formData.get("character"),
      skinColor: formData.get("skinColor"),
      hairColor: formData.get("hairColor"),
      shirtColor: formData.get("shirtColor"),
      backgroundColor: formData.get("backgroundColor"),
    },
    cefrLevel: cefrLevel ? cefrLevel : null,
    learningGoal: learningGoal ? learningGoal : null,
  };
}

export async function completeOnboardingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = profileFieldsSchema.safeParse(profileFieldsFromFormData(formData));
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "Check the form",
    };
  }
  try {
    await completeOnboarding(parsed.data as ProfileFields);
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
  redirect("/today");
}

export async function updateProfileAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = profileFieldsSchema.safeParse(profileFieldsFromFormData(formData));
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "Check the form",
    };
  }
  try {
    await updateProfileDetails(parsed.data as ProfileFields);
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
  revalidatePath("/profile");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/actions/profile.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/profile.ts src/server/actions/profile.test.ts
git commit -m "feat(onboarding): add completeOnboardingAction and updateProfileAction"
```

---

## Task 11: `AvatarBuilder` component

**Files:**
- Create: `src/features/onboarding/avatar-builder.tsx`
- Test: `src/features/onboarding/avatar-builder.test.tsx`
- Modify: `src/messages/en.json`, `src/messages/nl.json`

**Interfaces:**
- Consumes: `AVATAR_CHARACTERS`, `SKIN_COLORS`, `HAIR_COLORS`, `SHIRT_COLORS`, `BACKGROUND_COLORS`, `AvatarConfig` and id types (Task 1); `AVATAR_CHARACTER_COMPONENTS` (Task 3); `*_HEX` maps (Task 2).
- Produces: `AvatarBuilder({ value: AvatarConfig, onChange: (next: AvatarConfig) => void })` (consumed by Task 12's `ProfileForm`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/onboarding/avatar-builder.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { DEFAULT_AVATAR } from "@/types";

import { AvatarBuilder } from "./avatar-builder";

describe("AvatarBuilder", () => {
  it("calls onChange with the picked character", () => {
    const onChange = vi.fn();
    render(<AvatarBuilder value={DEFAULT_AVATAR} onChange={onChange} />);
    screen.getByLabelText("girl-2").click();
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_AVATAR, character: "girl-2" });
  });

  it("calls onChange with the picked hair color", () => {
    const onChange = vi.fn();
    render(<AvatarBuilder value={DEFAULT_AVATAR} onChange={onChange} />);
    screen.getByLabelText("blonde").click();
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_AVATAR, hairColor: "blonde" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/onboarding/avatar-builder.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/features/onboarding/avatar-builder.tsx`**

```tsx
"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { AVATAR_CHARACTER_COMPONENTS } from "@/components/ui/avatar-characters";
import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import { cn } from "@/lib/utils/cn";
import {
  AVATAR_CHARACTERS,
  BACKGROUND_COLORS,
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
  type AvatarConfig,
  type BackgroundColorId,
  type HairColorId,
  type ShirtColorId,
  type SkinColorId,
} from "@/types";

function SwatchRow<Id extends string>({
  label,
  ids,
  hexes,
  value,
  onChange,
}: {
  label: string;
  ids: readonly Id[];
  hexes: Record<Id, string>;
  value: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-medium text-fg-secondary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            aria-label={id}
            className={cn(
              "size-8 rounded-pill border-2",
              value === id ? "border-border-focus" : "border-transparent",
            )}
            style={{ backgroundColor: hexes[id] }}
          />
        ))}
      </div>
    </div>
  );
}

export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  const t = useTranslations("onboarding.avatar");
  const Character = AVATAR_CHARACTER_COMPONENTS[value.character];
  const previewStyle = {
    "--avatar-bg": BACKGROUND_COLOR_HEX[value.backgroundColor],
    "--avatar-hair": HAIR_COLOR_HEX[value.hairColor],
    "--avatar-shirt": SHIRT_COLOR_HEX[value.shirtColor],
    "--avatar-skin": SKIN_COLOR_HEX[value.skinColor],
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-center">
        <span className="grid size-24 place-items-center overflow-hidden rounded-pill" style={previewStyle}>
          <Character className="size-full" />
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label font-medium text-fg-secondary">{t("character")}</span>
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_CHARACTERS.map((id) => {
            const Option = AVATAR_CHARACTER_COMPONENTS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...value, character: id })}
                aria-pressed={value.character === id}
                aria-label={id}
                className={cn(
                  "grid size-10 place-items-center overflow-hidden rounded-pill border-2",
                  value.character === id ? "border-border-focus" : "border-transparent",
                )}
                style={previewStyle}
              >
                <Option className="size-full" />
              </button>
            );
          })}
        </div>
      </div>

      <SwatchRow<SkinColorId>
        label={t("skinColor")}
        ids={SKIN_COLORS}
        hexes={SKIN_COLOR_HEX}
        value={value.skinColor}
        onChange={(skinColor) => onChange({ ...value, skinColor })}
      />
      <SwatchRow<HairColorId>
        label={t("hairColor")}
        ids={HAIR_COLORS}
        hexes={HAIR_COLOR_HEX}
        value={value.hairColor}
        onChange={(hairColor) => onChange({ ...value, hairColor })}
      />
      <SwatchRow<ShirtColorId>
        label={t("shirtColor")}
        ids={SHIRT_COLORS}
        hexes={SHIRT_COLOR_HEX}
        value={value.shirtColor}
        onChange={(shirtColor) => onChange({ ...value, shirtColor })}
      />
      <SwatchRow<BackgroundColorId>
        label={t("backgroundColor")}
        ids={BACKGROUND_COLORS}
        hexes={BACKGROUND_COLOR_HEX}
        value={value.backgroundColor}
        onChange={(backgroundColor) => onChange({ ...value, backgroundColor })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add i18n keys**

Add a new top-level `"onboarding"` key to both `src/messages/en.json` and `src/messages/nl.json` (this task adds only the `avatar` sub-object; Tasks 12–13 add the rest of the `onboarding` key's siblings to the same object):

`en.json`:
```json
"onboarding": {
  "avatar": {
    "character": "Character",
    "skinColor": "Skin",
    "hairColor": "Hair",
    "shirtColor": "Shirt",
    "backgroundColor": "Background"
  }
}
```

`nl.json`:
```json
"onboarding": {
  "avatar": {
    "character": "Personage",
    "skinColor": "Huid",
    "hairColor": "Haar",
    "shirtColor": "Shirt",
    "backgroundColor": "Achtergrond"
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/onboarding/avatar-builder.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/avatar-builder.tsx src/features/onboarding/avatar-builder.test.tsx src/messages/en.json src/messages/nl.json
git commit -m "feat(onboarding): add the AvatarBuilder character/color picker"
```

---

## Task 12: `ProfileForm` component

**Files:**
- Create: `src/features/onboarding/profile-form.tsx`
- Test: `src/features/onboarding/profile-form.test.tsx`
- Modify: `src/messages/en.json`, `src/messages/nl.json`

**Interfaces:**
- Consumes: `AvatarBuilder` (Task 11), `completeOnboardingAction`/`updateProfileAction` (Task 10), `ProfileFields`/`CEFR_LEVELS`/`LEARNING_GOALS` (Task 1 and existing), `Button`/`Field`/`Input`/`Select` (existing `@/components/ui`).
- Produces: `ProfileForm({ mode: "onboarding" | "edit", initial: ProfileFields, onSaved?: () => void })` (consumed by Task 13's `OnboardingView` and Task 14's `EditProfileSection`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/onboarding/profile-form.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/server/actions/profile", () => ({
  completeOnboardingAction: vi.fn(async () => ({ ok: true, data: undefined })),
  updateProfileAction: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import { DEFAULT_AVATAR, type ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

const initial: ProfileFields = {
  fullName: "",
  nickname: "",
  avatar: DEFAULT_AVATAR,
  cefrLevel: null,
  learningGoal: null,
};

describe("ProfileForm", () => {
  it("renders required name fields and the avatar builder", () => {
    render(<ProfileForm mode="onboarding" initial={initial} />);
    expect(screen.getByLabelText("fullNameLabel")).toBeRequired();
    expect(screen.getByLabelText("nicknameLabel")).toBeRequired();
    expect(screen.getByLabelText("girl-1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/onboarding/profile-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/features/onboarding/profile-form.tsx`**

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Field, Input, Select } from "@/components/ui";
import { completeOnboardingAction, updateProfileAction } from "@/server/actions/profile";
import { CEFR_LEVELS, LEARNING_GOALS, type AvatarConfig, type ProfileFields } from "@/types";

import { AvatarBuilder } from "./avatar-builder";

/** Shared by /onboarding (mode="onboarding") and the /profile edit view
 * (mode="edit"). Field labels always come from the "onboarding" namespace
 * since the form is identical in both places. */
export function ProfileForm({
  mode,
  initial,
  onSaved,
}: {
  mode: "onboarding" | "edit";
  initial: ProfileFields;
  onSaved?: () => void;
}) {
  const t = useTranslations("onboarding");
  const action = mode === "onboarding" ? completeOnboardingAction : updateProfileAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [avatar, setAvatar] = useState<AvatarConfig>(initial.avatar);

  useEffect(() => {
    if (mode === "edit" && state?.ok === true) onSaved?.();
  }, [state, mode, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="character" value={avatar.character} />
      <input type="hidden" name="skinColor" value={avatar.skinColor} />
      <input type="hidden" name="hairColor" value={avatar.hairColor} />
      <input type="hidden" name="shirtColor" value={avatar.shirtColor} />
      <input type="hidden" name="backgroundColor" value={avatar.backgroundColor} />

      <AvatarBuilder value={avatar} onChange={setAvatar} />

      <Field label={t("fullNameLabel")} htmlFor="profile-full-name" required>
        <Input id="profile-full-name" name="fullName" defaultValue={initial.fullName} required />
      </Field>
      <Field label={t("nicknameLabel")} htmlFor="profile-nickname" required>
        <Input id="profile-nickname" name="nickname" defaultValue={initial.nickname} required />
      </Field>
      <Field label={t("cefrLabel")} htmlFor="profile-cefr">
        <Select id="profile-cefr" name="cefrLevel" defaultValue={initial.cefrLevel ?? ""}>
          <option value="">{t("cefrNone")}</option>
          {CEFR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("learningGoalLabel")} htmlFor="profile-goal">
        <Select id="profile-goal" name="learningGoal" defaultValue={initial.learningGoal ?? ""}>
          <option value="">{t("learningGoalNone")}</option>
          {LEARNING_GOALS.map((goal) => (
            <option key={goal} value={goal}>
              {t(`learningGoalOptions.${goal}`)}
            </option>
          ))}
        </Select>
      </Field>

      {state?.ok === false ? (
        <p role="alert" className="text-body-sm text-error-strong">
          {state.message}
        </p>
      ) : null}
      {mode === "edit" && state?.ok === true ? (
        <p className="text-body-sm text-success-strong">{t("saved")}</p>
      ) : null}

      <Button type="submit" disabled={pending} block>
        {t(mode === "onboarding" ? "submit" : "save")}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Add i18n keys**

Extend the `"onboarding"` key added in Task 11 with these siblings, in both `en.json` and `nl.json`:

`en.json`:
```json
"fullNameLabel": "Full name",
"nicknameLabel": "Nickname",
"cefrLabel": "Dutch level",
"cefrNone": "Prefer not to say",
"learningGoalLabel": "Why are you learning Dutch?",
"learningGoalNone": "Prefer not to say",
"learningGoalOptions": {
  "relocating": "Moving to the Netherlands",
  "work_study": "Work or study",
  "family": "Family",
  "curious": "Just curious"
},
"submit": "Continue",
"save": "Save changes",
"saved": "Saved"
```

`nl.json`:
```json
"fullNameLabel": "Volledige naam",
"nicknameLabel": "Bijnaam",
"cefrLabel": "Nederlands niveau",
"cefrNone": "Liever niet zeggen",
"learningGoalLabel": "Waarom leer je Nederlands?",
"learningGoalNone": "Liever niet zeggen",
"learningGoalOptions": {
  "relocating": "Verhuizen naar Nederland",
  "work_study": "Werk of studie",
  "family": "Familie",
  "curious": "Gewoon nieuwsgierig"
},
"submit": "Doorgaan",
"save": "Wijzigingen opslaan",
"saved": "Opgeslagen"
```

(These sit alongside the `"avatar": {...}` key already added in Task 11, inside the same `"onboarding"` object.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/onboarding/profile-form.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/profile-form.tsx src/features/onboarding/profile-form.test.tsx src/messages/en.json src/messages/nl.json
git commit -m "feat(onboarding): add the shared ProfileForm"
```

---

## Task 13: `OnboardingView` + `/onboarding` route

**Files:**
- Create: `src/features/onboarding/onboarding-view.tsx`
- Create: `src/features/onboarding/index.ts`
- Create: `src/app/(picker)/onboarding/page.tsx`
- Modify: `src/app/(picker)/layout.tsx`
- Modify: `src/messages/en.json`, `src/messages/nl.json`

**Interfaces:**
- Consumes: `ProfileForm` (Task 12), `DEFAULT_AVATAR`/`ProfileFields` (Task 1), `getCurrentUser` (existing), `getProfile` (Task 5), `titleMetadata` (existing `@/lib/page-metadata`).
- Produces: `OnboardingView` and `ProfileForm` re-exported from `@/features/onboarding` (the latter consumed by Task 14).

- [ ] **Step 1: Create `src/features/onboarding/onboarding-view.tsx`**

```tsx
import { getTranslations } from "next-intl/server";

import { DEFAULT_AVATAR, type ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

export async function OnboardingView() {
  const t = await getTranslations("onboarding");

  const initial: ProfileFields = {
    fullName: "",
    nickname: "",
    avatar: DEFAULT_AVATAR,
    cefrLevel: null,
    learningGoal: null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-h2 text-fg">{t("title")}</h1>
        <p className="text-body-sm text-fg-muted">{t("subtitle")}</p>
      </div>
      <ProfileForm mode="onboarding" initial={initial} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/features/onboarding/index.ts`**

```ts
export { OnboardingView } from "./onboarding-view";
export { ProfileForm } from "./profile-form";
```

- [ ] **Step 3: Create the route**

```tsx
// src/app/(picker)/onboarding/page.tsx
import { redirect } from "next/navigation";

import { OnboardingView } from "@/features/onboarding";
import { titleMetadata } from "@/lib/page-metadata";
import { getCurrentUser } from "@/server/auth/session";
import { getProfile } from "@/server/repositories/profiles";

export const generateMetadata = titleMetadata((t) => t("onboarding.title"));

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (profile?.onboardedAt) redirect("/today");

  return <OnboardingView />;
}
```

- [ ] **Step 4: Widen the `(picker)` layout**

In `src/app/(picker)/layout.tsx`, the avatar builder needs more room than the compact group-picker card — widen the card (this also affects `/groups`, which just gets extra breathing room):

```tsx
      <div className="w-full max-w-xl space-y-6 rounded-modal border border-border bg-surface p-8 shadow-card">
```

(changes `max-w-sm` to `max-w-xl`)

- [ ] **Step 5: Add i18n keys**

Add to the `"onboarding"` object in both `en.json` and `nl.json` (alongside `avatar`, `fullNameLabel`, etc. from Tasks 11–12):

`en.json`:
```json
"title": "Welcome! Let's set up your profile",
"subtitle": "Pick a name and build your avatar — you can change any of this later from your profile."
```

`nl.json`:
```json
"title": "Welkom! Laten we je profiel instellen",
"subtitle": "Kies een naam en maak je avatar — je kunt dit later altijd aanpassen via je profiel."
```

- [ ] **Step 6: Manually verify**

Run: `npm run dev`, sign in as a user whose profile has no `onboarded_at` (or temporarily null it out on the seeded admin row), confirm navigating to any `(app)` route redirects to `/onboarding`, the form renders with the avatar builder, and submitting with a name/nickname filled in redirects to `/today`.

- [ ] **Step 7: Run the gates**

Run: `npm run typecheck && npm run lint && npm test`
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/onboarding/onboarding-view.tsx src/features/onboarding/index.ts src/app/\(picker\)/onboarding/page.tsx src/app/\(picker\)/layout.tsx src/messages/en.json src/messages/nl.json
git commit -m "feat(onboarding): add the /onboarding route"
```

---

## Task 14: Wire profile editing into `/profile`

**Files:**
- Create: `src/features/profile/edit-profile-section.tsx`
- Modify: `src/features/profile/profile-view.tsx`
- Modify: `src/app/(app)/profile/page.tsx`
- Modify: `src/messages/en.json`, `src/messages/nl.json`

**Interfaces:**
- Consumes: `ProfileForm` (Task 13's re-export from `@/features/onboarding`), `getProfileDetails` (Task 9), `Avatar`/`Button` (existing `@/components/ui`).
- Produces: `EditProfileSection({ initial: ProfileFields, roleLabel: string | null, memberSinceLabel: string | null })`. `ProfileView`'s prop changes from `user: UserSummary` to `profileFields: ProfileFields`.

- [ ] **Step 1: Create `src/features/profile/edit-profile-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Avatar, Button } from "@/components/ui";
import { ProfileForm } from "@/features/onboarding";
import type { ProfileFields } from "@/types";

export function EditProfileSection({
  initial,
  roleLabel,
  memberSinceLabel,
}: {
  initial: ProfileFields;
  roleLabel: string | null;
  memberSinceLabel: string | null;
}) {
  const t = useTranslations("profile.edit");
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <ProfileForm
          mode="edit"
          initial={initial}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-5">
      <Avatar avatar={initial.avatar} size="lg" />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-display text-h3 text-fg">{initial.nickname}</span>
        {roleLabel && memberSinceLabel ? (
          <span className="text-body-sm text-fg-muted">
            {roleLabel} · {memberSinceLabel}
          </span>
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        {t("editButton")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/features/profile/profile-view.tsx`**

```tsx
import { getLocale, getTranslations } from "next-intl/server";

import { PageContainer, PageHeader } from "@/components/layout";
import { formatDateShort } from "@/lib/utils/date";
import type { GroupMemberSummary, KnowledgeType, ProfileFields, StudyHistory } from "@/types";

import { EditProfileSection } from "./edit-profile-section";
import { PreferencesSection } from "./preferences-section";
import { ProgressSection } from "./progress-section";
import { ReviewListSection } from "./review-list-section";

export async function ProfileView({
  profileFields,
  member,
  libraryStats,
  studyHistory,
}: {
  profileFields: ProfileFields;
  member?: GroupMemberSummary;
  libraryStats: Record<KnowledgeType, number> & { total: number };
  studyHistory: StudyHistory;
}) {
  const [t, tPage, locale] = await Promise.all([
    getTranslations("profile"),
    getTranslations("pages.profile"),
    getLocale(),
  ]);

  const roleLabel = member
    ? { owner: t("role.owner"), member: t("role.member") }[member.role]
    : null;
  const memberSinceLabel = member
    ? t("memberSince", { date: formatDateShort(member.joinedAt, locale) })
    : null;

  return (
    <PageContainer>
      <PageHeader title={tPage("title")} description={tPage("subtitle")} />

      <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-8">
        <EditProfileSection
          initial={profileFields}
          roleLabel={roleLabel}
          memberSinceLabel={memberSinceLabel}
        />

        <PreferencesSection />
        <ProgressSection libraryStats={libraryStats} history={studyHistory} />
        <ReviewListSection />
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 3: Update `src/app/(app)/profile/page.tsx`**

```tsx
import { redirect } from "next/navigation";

import { ProfileView } from "@/features/profile";
import { titleMetadata } from "@/lib/page-metadata";
import { getCurrentUser } from "@/server/auth/session";
import { getGroupSettings } from "@/server/services/group-service";
import { getLibraryStats } from "@/server/services/knowledge-service";
import { getStudyHistory } from "@/server/services/personal-service";
import { getProfileDetails } from "@/server/services/profile-service";

export const generateMetadata = titleMetadata((t) => t("pages.profile.title"));

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profileFields, settings, libraryStats, studyHistory] = await Promise.all([
    getProfileDetails(),
    getGroupSettings(),
    getLibraryStats(),
    getStudyHistory(10),
  ]);
  const member = settings.members.find((m) => m.id === user.id);

  return (
    <ProfileView
      profileFields={profileFields}
      member={member}
      libraryStats={libraryStats}
      studyHistory={studyHistory}
    />
  );
}
```

- [ ] **Step 4: Add i18n key**

Add an `"edit"` object inside the existing `"profile"` key in both `en.json` and `nl.json`:

`en.json`:
```json
"edit": {
  "editButton": "Edit profile"
}
```

`nl.json`:
```json
"edit": {
  "editButton": "Profiel bewerken"
}
```

- [ ] **Step 5: Manually verify**

Run: `npm run dev`, sign in as an onboarded user, open `/profile`, click "Edit profile", change the nickname and avatar, save, and confirm the read-only header updates (via `router.refresh()`) and the avatar shown in the nav/knowledge attribution elsewhere updates too on next navigation.

- [ ] **Step 6: Run the gates**

Run: `npm run typecheck && npm run lint && npm test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/edit-profile-section.tsx src/features/profile/profile-view.tsx src/app/\(app\)/profile/page.tsx src/messages/en.json src/messages/nl.json
git commit -m "feat(onboarding): make /profile editable via the shared ProfileForm"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run every gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: All green.

- [ ] **Step 2: Spot-check the full flow manually**

`npm run dev`: create a fresh invite, accept it as a new user, confirm landing on `/onboarding` (not `/today`), fill in the form (including picking a non-default character and colors), submit, confirm redirect to `/today` and that the chosen avatar shows correctly in the nav, the knowledge "added by" tags, and the group roster at every `Avatar` size. Then revisit `/onboarding` directly and confirm it redirects to `/today` instead of re-showing the form.

- [ ] **Step 3: Commit anything outstanding**

```bash
git status
```

If clean, this plan is complete. If anything is outstanding (e.g. a migration applied but not yet reflected in a commit), commit it with an appropriate message.
