# Onboarding & Profile Details — Design

Date: 2026-09-19

## Problem

Today, when an invited user accepts their invite, `acceptInvitation()` seeds a
`profiles` row automatically: `displayName`/`initials` derived from their
email address, `accent` derived from a hash of their user id
(`src/server/services/invite-service.ts`, `src/server/auth/identity.ts`). The
user never chooses anything about their own identity in the app, and there is
no way to edit it later — `/profile` (`src/features/profile/profile-view.tsx`)
is read-only except for the language toggle.

This phase adds a mandatory first-sign-in onboarding step where the user
fills in their real name, a display nickname, builds a custom avatar, and
optionally states their Dutch level and learning goal. Whatever they fill in
becomes their profile, editable later from `/profile`.

## Data model

`profiles` table changes (`src/server/db/schema.ts`):

| Change | Column | Notes |
|---|---|---|
| rename | `display_name` → `nickname` | Same semantics as today (the name shown everywhere), now user-editable |
| add | `full_name` (text, not null) | Formal name, new — used for the record, not for everyday display |
| add | `avatar` (jsonb, nullable) | `{ character, skinColor, hairColor, shirtColor, backgroundColor }` — all palette ids, not raw hex. `null` = not yet built (pre-onboarding, or a groupmate mid-onboarding) |
| add | `cefr_level` (text, nullable) | Same CHECK pattern as `knowledge_items.level` / `study_runs.level`: `NULL OR IN ('A1','A2','B1','B2','C1','C2')` |
| add | `learning_goal` (new enum, nullable) | `pgEnum("learning_goal", ["relocating", "work_study", "family", "curious"])` |
| add | `onboarded_at` (timestamptz, nullable) | The gate signal: `null` means onboarding is not complete |
| drop | `initials` | Superseded by the avatar; nothing reads it once `Avatar` no longer accepts initials |
| drop | `accent` | Superseded by `avatar.backgroundColor` etc. |

At invite-accept time, `upsertProfile` keeps seeding a placeholder row
(`fullName`/`nickname` = email prefix, `avatar` = `null`, `onboarded_at` =
`null`) so the row is never partially null. Onboarding overwrites these
fields and sets `onboarded_at`.

One Drizzle migration covers the rename/add/drop. Given the recent full DB
reset, the only existing row is the admin account, which will go through
onboarding once too — no data backfill needed.

### AvatarConfig type

```ts
// src/lib/avatar-palette.ts
export type AvatarCharacterId =
  | "girl-1" | "girl-2" | "girl-3" | "girl-4" | "girl-5"
  | "boy-1"  | "boy-2"  | "boy-3"  | "boy-4"  | "boy-5";

export interface AvatarConfig {
  character: AvatarCharacterId;
  skinColor: SkinColorId;
  hairColor: HairColorId;
  shirtColor: ShirtColorId;
  backgroundColor: BackgroundColorId;
}
```

`SkinColorId`/`HairColorId`/`ShirtColorId`/`BackgroundColorId` are string
literal unions over small curated palettes (~6 skin tones, ~8 hair colors, ~8
shirt colors, ~6 backgrounds) defined alongside their actual color values in
`avatar-palette.ts`. Ids are stored, not hex, so the palette can be re-tuned
later without a migration or meaning-shift in stored data being a concern.

## Avatar system

- 10 flat SVG character components in
  `src/components/ui/avatar-characters/` (`GirlOne`…`GirlFive`,
  `BoyOne`…`BoyFive`). Each exposes four fill regions wired to CSS custom
  properties: `--avatar-skin`, `--avatar-hair`, `--avatar-shirt`,
  `--avatar-bg`. One `Avatar` component recolors any character by setting
  these four custom properties — no per-character color-mapping logic.
- Design constraint: `Avatar` renders as small as 24px (`size="xs"`, used
  next to knowledge items in `meta-row.tsx`) up to 48px (`size="lg"`, profile
  page). The character art must read clearly at 24px — flat shapes, thick
  outlines, minimal detail — designed for the smallest case first.
- `Avatar` component (`src/components/ui/avatar.tsx`) signature changes:
  - Before: `{ initials: string; accent?: AvatarAccent }`
  - After: `{ avatar: AvatarConfig | null }`
  - When `avatar` is `null` — a groupmate visible in the roster who hasn't
    finished onboarding yet — it renders a neutral placeholder silhouette.
    There is no initials text to fall back to anymore; an `aria-label` (the
    person's name) still applies when the avatar stands alone.
- Call sites to update: `profile-view.tsx`, `group-settings-view.tsx`,
  `meta-row.tsx`.
- Type changes: `UserSummary`/`GroupMemberSummary`
  (`src/types/user.ts`) replace `initials`/`accent` with
  `avatar: AvatarConfig | null`. Every place that builds a `UserSummary`
  (`getCurrentUser` in `src/server/auth/session.ts`, `listGroupsForUser`,
  the `addedBy`/`updatedBy` mapping in `src/server/repositories/knowledge.ts`)
  updates to read the new `avatar` jsonb column instead of
  `initials`/`accent`.
- `src/server/auth/identity.ts` (`deriveInitials`/`deriveAccent`) is deleted
  — nothing derives an avatar from the email/user id anymore; the user picks
  it explicitly during onboarding.

## Onboarding flow & gating

- New route: `src/app/(picker)/onboarding/page.tsx`. Reuses the existing
  `(picker)` layout (centered card, no app shell — the same family as
  `/groups`), though the card will likely need a wider `max-w` than the
  current `max-w-sm` to fit the avatar builder; left to the UI pass.
- `ActiveContext` (`src/types/group.ts`) gains a new member:
  `{ status: "needs-onboarding" }`.
- `resolveActiveContext()` (`src/server/services/session-service.ts`) checks
  it right after `needs-login`, before group resolution:
  ```ts
  const user = await getCurrentUser();
  if (!user) return { status: "needs-login" };
  const profile = await getProfile(user.id);
  if (!profile?.onboardedAt) return { status: "needs-onboarding" };
  // ...existing group resolution unchanged
  ```
- `(app)/layout.tsx` gets one more redirect, matching the existing
  `needs-group` line: `if (ctx.status === "needs-onboarding") redirect("/onboarding")`.
- **Why no other route needs a guard**: a user only reaches the `/groups`
  picker (`src/app/(picker)/groups/page.tsx`) when they belong to more than
  one group. The only way to gain a second group is being invited again
  after already using the app once — meaning they're already onboarded. A
  not-yet-onboarded user's single group always auto-selects
  (`resolveActiveContext`'s existing `groups.length === 1` branch) and lands
  them in `(app)`, where the gate lives.
- `/onboarding` itself does a direct check (mirroring `/groups`'s own
  defensive check): not logged in → `/login`; `onboardedAt` already set
  (e.g. user navigates back manually) → `/today`.
- Invite-accept (`src/app/(auth)/invite/[token]/route.ts`) keeps redirecting
  to `/today` unchanged — the `(app)` layout gate takes it from there.

## Form & profile editing

- One shared form component, `ProfileForm`
  (`src/features/onboarding/profile-form.tsx`), used two ways:
  - **`/onboarding`**: fields start empty (name/nickname/CEFR/goal) or with
    no avatar selected. Submits via a new server action
    `completeOnboarding(fields)` which validates with zod and, only if
    `onboarded_at` is currently `null`, sets it to `now()` alongside the
    submitted fields.
  - **`/profile`**: the existing read-only `ProfileView` gains an edit mode
    (toggle or dedicated section) using the same form, pre-filled with
    current values. Submits via `updateProfile(fields)`, which never touches
    `onboarded_at`.
- Required vs optional: `fullName`, `nickname`, and a complete avatar
  (character + all four colors) are required to finish onboarding.
  `cefrLevel` and `learningGoal` are optional in both onboarding and
  `/profile` editing — personalization-only, fine to leave blank.
- Avatar builder UI: a character grid (10 options, grouped girl/boy) plus
  four labeled swatch rows (background, hair, shirt, skin), each swatch row
  showing the curated palette for that part; a live preview of the selected
  character with the chosen colors applied.
- Repository: new `updateProfile(userId, fields)` in
  `src/server/repositories/profiles.ts`, separate from the existing
  accept-time `upsertProfile` (that one only ever seeds the placeholder
  row).

## i18n

New top-level `onboarding` key plus `pages.onboarding` (title/subtitle,
mirroring other pages), and new `profile.edit.*` keys for the edit-mode
labels — added to both `src/messages/en.json` and `src/messages/nl.json`.

## Testing

- `resolveActiveContext`: unit test covering the new `needs-onboarding`
  transition (profile exists but `onboarded_at` is null) ordered correctly
  relative to `needs-login`/`needs-group`.
- `completeOnboarding` / `updateProfile` actions: zod validation rejects
  incomplete avatar/missing required fields; `completeOnboarding` sets
  `onboarded_at` only when it was previously null (idempotent on retry,
  never resets on a later `/profile` edit).
- `Avatar` component: renders the correct character with the correct CSS
  custom properties for a given `AvatarConfig`; renders the neutral
  placeholder when `avatar` is `null`.
- Existing repository/integration tests that reference `initials`/`accent`
  (`knowledge.integration.test.ts`, `repositories.integration.test.ts`)
  update to the new `avatar` shape.

## Out of scope

- Uploading a real photo as an avatar (`UserSummary.avatarUrl` stays unused).
- Using `cefrLevel`/`learningGoal` to actually personalize practice/exam
  defaults — this phase only collects and stores them.
- Any admin/owner-facing view of onboarding completion status across a
  group.
