# DiceBear Micah Avatar — Design

Date: 2026-09-20

## Problem

The onboarding/profile avatar builder (shipped 2026-09-20, PR #25) offers 10
hand-drawn characters recolored through CSS custom properties. This replaces it
with **DiceBear's Micah style**, generated locally, with a richer editor: hairstyle,
accessories and four color choices, a live preview and a "Surprise me" button.

## Facts about the installed packages (verified)

- `@dicebear/core@10.7.0` (MIT) and `@dicebear/styles@10.6.0`. Requires Node 22+.
- `@dicebear/styles` ships **JSON style definitions**, not JS modules
  (`@dicebear/styles/micah.json`). Rendering is
  `new Avatar(new Style(definition), options)`; `.toDataUri()` returns a
  `data:image/svg+xml` URI. Passing a raw definition to `Avatar` is deprecated
  (removed in v11), so a shared `Style` instance is used.
- Micah components/variants:
  - `hair`: `full, pixie, fonze, dougFunny, dannyPhantom, mrT, mrClean, turban`
  - `glasses`: `round, square` (has `probability`)
  - `earrings`: `hoop, stud` (has `probability`)
  - `facialHair`: `beard, scruff` (has `probability`)
  - seed-driven only (not user-editable here): `eyes, eyebrows, mouth, nose,
    ears, clothes, head`
- Micah colors: `base` (skin), `hair`, `shirt`, `background` (+ fixed-black
  eyes/mouth/brows). Some carry `notEqualTo` constraints; the curated palettes
  contain no colliding values, verified during implementation.
- **License: Micah is CC BY 4.0** (Micah Lanier, "Avatar Illustration System",
  remixed by DiceBear). Visible attribution is required.

## Data model

`src/types/avatar.ts` is rewritten:

```ts
interface AvatarConfig {
  provider: "dicebear";
  style: "micah";
  version: 1;
  seed: string;                 // drives eyes/brows/mouth/nose/ears/clothes
  hair: HairStyle;              // "full" | "pixie" | "fonze" | "dougFunny" | "dannyPhantom" | "mrT" | "mrClean" | "turban"
  hairColor: HairColorId;       // palette ids (not hex), unchanged palettes
  skinColor: SkinColorId;
  shirtColor: ShirtColorId;
  backgroundColor: BackgroundColorId;
  glasses?: "round" | "square"; // absent = none
  earrings?: "hoop" | "stud";
  facialHair?: "beard" | "scruff";
}
```

- Colors stay as **palette ids** (curated Welkom palettes in
  `src/lib/avatar-palette.ts`: 6 skin / 8 hair / 8 shirt / 6 background). The
  server allow-list therefore enforces "design-system colors only", and palettes
  can be re-tuned without a data migration.
- Stored in the existing `profiles.avatar` `jsonb` column. **No SQL migration.**
  The column's `$type<AvatarConfig>()` changes; the DB is unaffected.
- Gender is never a field. Hair labels are neutral (EN + NL).

## Read/write path

- **Write:** `avatarConfigSchema` (zod, strict enums, `version: z.literal(1)`,
  optional accessory enums) validates in `profileFieldsSchema`. The form posts a
  single hidden `avatar` JSON field (replacing five hidden inputs);
  `profileFieldsFromFormData` parses it in a try/catch and lets zod report
  invalid data as a normal `validation` error.
- **Read:** `resolveAvatar(raw: unknown, userId: string): AvatarConfig` returns
  the stored config when it passes the schema, otherwise
  `defaultAvatarFor(userId)`. This covers null, the legacy 10-character shape,
  future/unknown versions and corrupt JSON.
- `defaultAvatarFor(userId)` is deterministic: `seed = userId`; hair and the
  four colors are chosen by hashing the ID into the palettes; no accessories.
- `resolveAvatar` is applied in the mappers that already read `profiles.avatar`:
  `src/server/auth/session.ts`, `repositories/memberships.ts`,
  `repositories/knowledge.ts`, `services/profile-service.ts`. `UserSummary.avatar`
  stays typed `AvatarConfig | null`; `null` now only means "no profile row", so
  existing test fixtures do not change. The `avatar ?? DEFAULT_AVATAR` fallback
  in `profile-service` is replaced by `resolveAvatar` and `DEFAULT_AVATAR` is
  removed.

## Rendering

- `src/lib/avatar/micah.ts` (server + client safe, pure):
  `toMicahOptions(config, size)` maps a config to DiceBear options, pinning
  `hairVariant`/`hairProbability: 100`, the four colors, and for each accessory
  either `Variant` + `Probability: 100` or `Probability: 0` (so the seed can
  never add a beard/glasses the user didn't choose). `avatarDataUri(config)` uses
  a module-level `Style` singleton and a small bounded memo keyed by the JSON
  config.
- `src/components/ui/avatar.tsx` keeps its public API (`{ avatar, size }`), so
  existing call sites (`profile-view`, `group-settings-view`, `meta-row`) are
  untouched. It renders an `<img src={dataUri} alt="" draggable={false}>` inside
  the existing circle — **no `dangerouslySetInnerHTML`**. Decorative by default;
  `aria-label` on the wrapper when the avatar stands alone. `null` still renders
  the placeholder silhouette. A new `xl` size serves the builder preview. The
  crop at 24px (`xs`) is checked visually; a small zoom via DiceBear's
  `scale`/`translateY` is applied only if needed.
- `randomAvatar()` (used by "Surprise me") builds a valid config from a fresh
  random seed plus random picks from every enum/palette, including whether each
  optional accessory is present.

## Builder UI

`src/features/onboarding/avatar-builder.tsx` is rewritten; `ProfileForm` and
`onboarding-view` layout are otherwise unchanged.

- Large live preview (`Avatar size="xl"`) with a **Surprise me** button (lucide
  `Dices`).
- Rows: **Hair**, **Glasses**, **Earrings**, **Facial hair** as thumbnail
  choices (mini avatars in the currently selected colors, so what you see is
  what you get); optional rows include a "None" tile. **Skin**, **Hair color**,
  **Shirt**, **Background** as color circles with i18n color names.
- Each row is a `role="radiogroup"` (labelled) of visually-hidden native radio
  inputs inside `<label>`s: arrow-key navigation, tab stop and form semantics
  come from the platform. Selected = ring + check; hover = subtle lift/ring;
  `has-[:focus-visible]` ring for keyboard focus.
- Motion (hover lift, press scale) is wrapped in `motion-safe:`; nothing animates
  under `prefers-reduced-motion`.
- Responsive: single column on mobile with ≥40px targets; larger thumbnail/color
  grids on `md+`. Verified with the same-origin iframe harness at mobile and
  desktop widths.
- i18n: `onboarding.avatar.*` in `en.json` and `nl.json` (row labels, hair style
  names, color names, "None", "Surprise me", the CC BY credit line).
- Attribution: a small "Avatars: Micah Lanier, CC BY 4.0" credit line with links
  under the builder.

## Cleanup (after grep-verifying no other users)

Delete `src/components/ui/avatar-characters/*`, the old character list/id types in
`src/types/avatar.ts`, `DEFAULT_AVATAR`, the `--avatar-*` CSS-variable plumbing
and their tests. Keep `avatar-palette.ts` hex maps. Update `src/types/index.ts`
exports and `src/components/ui/index.ts` as needed.

## Testing

- Unit: `resolveAvatar` (valid, legacy shape, garbage, null → default; same
  user ID → same default), `randomAvatar` validity over 200 iterations,
  `toMicahOptions` pinning (probability 0/100), palette values free of
  `notEqualTo` collisions, `avatarDataUri` returns a `data:image/svg+xml` URI and
  differs when hair changes.
- Round trip: config → JSON → `resolveAvatar` → identical rendered SVG.
- Updated: `schemas.test.ts`, `avatar.test.tsx`, `avatar-builder.test.tsx`,
  `profile-form.test.tsx`, `profile-service.test.ts`.
- Gates: `npm run typecheck`, `npm run lint`, `npm test` (prettier check is
  known-red repo-wide and is not a gate).
- Manual: real save via the dev app confirms persistence and reconstruction;
  mobile + desktop check of `/onboarding` through the iframe harness.

## Manual steps for the owner

- `npm install` after merge (two new dependencies). No DB migration, no env vars.
- The existing admin profile has a legacy avatar; it shows a deterministic default
  until re-saved from `/profile`.

## Out of scope

- User control over eyes/mouth/nose/eyebrows/ears/clothes (seed-driven).
- Photo avatars (`UserSummary.avatarUrl` stays unused).
- Migrating legacy avatars to a "closest" Micah look.
