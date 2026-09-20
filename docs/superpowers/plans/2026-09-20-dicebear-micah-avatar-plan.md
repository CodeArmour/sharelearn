# DiceBear Micah Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 10-character avatar builder with a locally generated DiceBear **Micah** avatar editor (hair, accessories, four palette colors, Surprise me), persisted as a versioned structured config.

**Architecture:** A pure `src/lib/avatar/*` layer (config schema, deterministic default, random, resolve-with-fallback, Micah rendering) sits under a rewritten `Avatar` component (`<img>` with a local SVG data URI) and a rewritten radiogroup-based `AvatarBuilder`. `profiles.avatar` stays a `jsonb` column (no SQL migration); every server mapper that reads it goes through `resolveAvatar(raw, userId)`, so legacy/invalid data falls back to a deterministic per-user default.

**Tech Stack:** Next.js 16 (React 19, React Compiler), TypeScript, Tailwind 4, next-intl, zod 4, Drizzle/Supabase, Vitest + Testing Library, `@dicebear/core@^10.7.0`, `@dicebear/styles@^10.6.0`.

**Spec:** `docs/superpowers/specs/2026-09-20-dicebear-micah-avatar-design.md`

## Global Constraints

- Work on branch `feat/dicebear-micah-avatar` (already created; spec committed as `03e5ec0`).
- `AGENTS.md`: this is a newer Next.js than training data. This plan only uses plain React/`<img>`/client-component patterns; if you touch any Next.js API beyond what is shown, read the relevant guide in `node_modules/next/dist/docs/` first.
- Runtime: DiceBear v10 requires Node 22+ (local Node is 24).
- Generate avatars **locally**; never call the public DiceBear HTTP API.
- Render via `<img src="data:image/svg+xml…">`; **no `dangerouslySetInnerHTML`**, no SVG strings stored in the database.
- Store palette **ids** (not hex); hex lives only in `src/lib/avatar-palette.ts`.
- `profiles.avatar` remains `jsonb`: **no SQL migration**, no schema change beyond the `$type` (which already reads `AvatarConfig` from `@/types`).
- `UserSummary.avatar` stays typed `AvatarConfig | null`; `null` only means "no profile row".
- Do not expose gender as a choice; hair labels are neutral.
- Micah is **CC BY 4.0**: the builder shows a credit line ("Micah Lanier", "CC BY 4.0", "DiceBear" links).
- Hover/press motion must use `motion-safe:`; keyboard focus uses `peer-focus-visible:` outlines.
- All new strings go in both `src/messages/en.json` and `src/messages/nl.json`.
- Gates are `npm run typecheck`, `npm run lint`, `npm test`. **Prettier check is red repo-wide on main: do not run `prettier --write`**; match surrounding style.
- Never run anything that writes to the shared dev database from tests (`TEST_DATABASE_URL` guard exists; `resetTables()` is refused there). This plan needs no DB tests.
- Commit trailers (every commit):
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ
  ```
- **Typecheck window:** Tasks 1–4 replace the `AvatarConfig` type under still-unmigrated consumers, so `npm run typecheck` is expected to be **red after Tasks 1–4 and green only after Task 5**. Until then, verify each task with the targeted `npx vitest run <paths>` command shown in it.

## File Structure

| File | Responsibility |
|---|---|
| `src/types/avatar.ts` (rewrite) | `AvatarConfig`, option/palette id constants and types |
| `src/lib/avatar/schema.ts` (new) | zod `avatarConfigSchema` (strict enums, `version: 1`) |
| `src/lib/avatar/generate.ts` (new) | `defaultAvatarFor(userId)`, `randomAvatar(rng?)` (pure, no zod, no dicebear) |
| `src/lib/avatar/resolve.ts` (new) | `resolveAvatar(raw, userId)` tolerant read |
| `src/lib/avatar/micah.ts` (new) | `toMicahOptions`, `avatarDataUri` (only file importing `@dicebear/*`) |
| `src/lib/avatar-palette.ts` (keep) | id → hex maps |
| `src/components/ui/avatar.tsx` (rewrite) | reusable `<Avatar avatar size>` (`<img>` data URI) |
| `src/components/ui/avatar-characters/*` (delete) | old hand-drawn characters |
| `src/features/onboarding/avatar-option-group.tsx` (new) | one accessible radiogroup row (tiles or color swatches) |
| `src/features/onboarding/avatar-builder.tsx` (rewrite) | preview, Surprise me, rows, credit |
| `src/features/onboarding/profile-form.tsx` | post one `avatar` JSON field |
| `src/features/onboarding/onboarding-view.tsx`, `src/app/(picker)/onboarding/page.tsx` | pass the initial avatar |
| `src/server/actions/schemas.ts`, `src/server/actions/profile.ts` | validate/parse the JSON avatar |
| `src/server/auth/session.ts`, `src/server/repositories/{memberships,knowledge}.ts`, `src/server/services/profile-service.ts` | read through `resolveAvatar` |
| `src/messages/{en,nl}.json` | `onboarding.avatar.*` |

---

### Task 1: Dependencies, types and the pure avatar library

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Rewrite: `src/types/avatar.ts`, `src/types/avatar.test.ts`
- Create: `src/lib/avatar/schema.ts`, `src/lib/avatar/generate.ts`, `src/lib/avatar/resolve.ts`, `src/lib/avatar/micah.ts`
- Create tests: `src/lib/avatar/generate.test.ts`, `src/lib/avatar/resolve.test.ts`, `src/lib/avatar/micah.test.ts`
- Modify test: `src/lib/avatar-palette.test.ts`

**Interfaces:**
- Produces (from `@/types`): `HAIR_STYLES`, `GLASSES_VARIANTS`, `EARRINGS_VARIANTS`, `FACIAL_HAIR_VARIANTS`, `SKIN_COLORS`, `HAIR_COLORS`, `SHIRT_COLORS`, `BACKGROUND_COLORS`, types `HairStyle`, `GlassesVariant`, `EarringsVariant`, `FacialHairVariant`, `SkinColorId`, `HairColorId`, `ShirtColorId`, `BackgroundColorId`, `AvatarConfig`.
- Produces: `avatarConfigSchema` (`@/lib/avatar/schema`), `defaultAvatarFor(userId: string): AvatarConfig`, `randomAvatar(rng?: () => number): AvatarConfig` (`@/lib/avatar/generate`), `resolveAvatar(raw: unknown, userId: string): AvatarConfig` (`@/lib/avatar/resolve`), `toMicahOptions(config): StyleOptions<typeof micah>`, `avatarDataUri(config): string` (`@/lib/avatar/micah`).
- Removes: `AVATAR_CHARACTERS`, `AvatarCharacterId`, `DEFAULT_AVATAR`.

- [ ] **Step 1: Record the baseline**

Run: `npm run typecheck ; npm run lint ; npm test`
Note which failures (if any) already exist on this branch before you change anything, so you can tell them apart later. (Integration tests that need a throwaway DB are refused by design; that is not new.)

- [ ] **Step 2: Install DiceBear**

Run: `npm install @dicebear/core@^10.7.0 @dicebear/styles@^10.6.0`
Expected: both appear under `dependencies` in `package.json`.

- [ ] **Step 3: Write the failing tests**

`src/types/avatar.test.ts` (replace the file):

```ts
import { describe, expect, it } from "vitest";

import {
  BACKGROUND_COLORS,
  EARRINGS_VARIANTS,
  FACIAL_HAIR_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_COLORS,
} from "./avatar";

describe("avatar constants", () => {
  const lists = {
    HAIR_STYLES,
    GLASSES_VARIANTS,
    EARRINGS_VARIANTS,
    FACIAL_HAIR_VARIANTS,
    SKIN_COLORS,
    HAIR_COLORS,
    SHIRT_COLORS,
    BACKGROUND_COLORS,
  } as const;

  it.each(Object.entries(lists))("%s is non-empty with unique ids", (_name, list) => {
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list).size).toBe(list.length);
  });
});
```

Append to `src/lib/avatar-palette.test.ts` inside the existing `describe`:

```ts
  it("never reuses a hex value across palettes (Micah colors carry notEqualTo rules)", () => {
    const all = [SKIN_COLOR_HEX, HAIR_COLOR_HEX, SHIRT_COLOR_HEX, BACKGROUND_COLOR_HEX].flatMap(
      (map) => Object.values(map).map((hex) => hex.toLowerCase()),
    );
    expect(new Set(all).size).toBe(all.length);
  });
```

`src/lib/avatar/generate.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { defaultAvatarFor, randomAvatar } from "./generate";
import { avatarConfigSchema } from "./schema";

describe("defaultAvatarFor", () => {
  it("is deterministic for a user id", () => {
    expect(defaultAvatarFor("user-1")).toEqual(defaultAvatarFor("user-1"));
  });

  it("uses the user id as the seed and picks no accessories", () => {
    const avatar = defaultAvatarFor("user-1");
    expect(avatar.seed).toBe("user-1");
    expect(avatar).not.toHaveProperty("glasses");
    expect(avatar).not.toHaveProperty("earrings");
    expect(avatar).not.toHaveProperty("facialHair");
  });

  it("produces a schema-valid config", () => {
    expect(avatarConfigSchema.safeParse(defaultAvatarFor("user-1")).success).toBe(true);
  });

  it("varies between users", () => {
    const distinct = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(defaultAvatarFor(`user-${i}`))),
    );
    expect(distinct.size).toBeGreaterThan(10);
  });
});

describe("randomAvatar", () => {
  it("always produces a schema-valid config", () => {
    for (let i = 0; i < 200; i++) {
      const result = avatarConfigSchema.safeParse(randomAvatar());
      expect(result.success).toBe(true);
    }
  });

  it("can include every accessory", () => {
    const avatar = randomAvatar(() => 0);
    expect(avatar.glasses).toBeDefined();
    expect(avatar.earrings).toBeDefined();
    expect(avatar.facialHair).toBeDefined();
  });

  it("can omit every accessory", () => {
    const avatar = randomAvatar(() => 0.99);
    expect(avatar).not.toHaveProperty("glasses");
    expect(avatar).not.toHaveProperty("earrings");
    expect(avatar).not.toHaveProperty("facialHair");
  });

  it("uses a fresh seed each call", () => {
    expect(randomAvatar().seed).not.toBe(randomAvatar().seed);
  });
});
```

`src/lib/avatar/resolve.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { defaultAvatarFor } from "./generate";
import { resolveAvatar } from "./resolve";

const valid = defaultAvatarFor("someone-else");

describe("resolveAvatar", () => {
  it("returns a valid stored config unchanged", () => {
    expect(resolveAvatar(valid, "u1")).toEqual(valid);
  });

  it("keeps optional accessories", () => {
    const withAccessories = { ...valid, glasses: "round", facialHair: "beard" };
    expect(resolveAvatar(withAccessories, "u1")).toEqual(withAccessories);
  });

  it("survives a JSON round trip", () => {
    expect(resolveAvatar(JSON.parse(JSON.stringify(valid)), "u1")).toEqual(valid);
  });

  it("strips unknown keys", () => {
    expect(resolveAvatar({ ...valid, extra: 1 }, "u1")).toEqual(valid);
  });

  it("falls back to the deterministic default for null and undefined", () => {
    expect(resolveAvatar(null, "u1")).toEqual(defaultAvatarFor("u1"));
    expect(resolveAvatar(undefined, "u1")).toEqual(defaultAvatarFor("u1"));
  });

  it("falls back for the legacy 10-character shape", () => {
    const legacy = {
      character: "girl-1",
      skinColor: "tan",
      hairColor: "black",
      shirtColor: "teal",
      backgroundColor: "cream",
    };
    expect(resolveAvatar(legacy, "u1")).toEqual(defaultAvatarFor("u1"));
  });

  it("falls back for an unknown version and for garbage", () => {
    expect(resolveAvatar({ ...valid, version: 2 }, "u1")).toEqual(defaultAvatarFor("u1"));
    for (const junk of ["nope", 42, [], {}]) {
      expect(resolveAvatar(junk, "u1")).toEqual(defaultAvatarFor("u1"));
    }
  });
});
```

`src/lib/avatar/micah.test.ts`:

```ts
// @vitest-environment node
import { Avatar, Style } from "@dicebear/core";
import micah from "@dicebear/styles/micah.json";
import { describe, expect, it } from "vitest";

import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import {
  EARRINGS_VARIANTS,
  FACIAL_HAIR_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_STYLES,
  type AvatarConfig,
} from "@/types";

import { resolveAvatar } from "./resolve";
import { avatarDataUri, toMicahOptions } from "./micah";

const base: AvatarConfig = {
  provider: "dicebear",
  style: "micah",
  version: 1,
  seed: "seed-1",
  hair: "pixie",
  hairColor: "brown",
  skinColor: "tan",
  shirtColor: "teal",
  backgroundColor: "cream",
};

const variantsOf = (component: keyof typeof micah.components) =>
  Object.keys(micah.components[component].variants).sort();

describe("option lists match the installed Micah definition", () => {
  it("hair, glasses, earrings and facialHair variants", () => {
    expect([...HAIR_STYLES].sort()).toEqual(variantsOf("hair"));
    expect([...GLASSES_VARIANTS].sort()).toEqual(variantsOf("glasses"));
    expect([...EARRINGS_VARIANTS].sort()).toEqual(variantsOf("earrings"));
    expect([...FACIAL_HAIR_VARIANTS].sort()).toEqual(variantsOf("facialHair"));
  });
});

describe("toMicahOptions", () => {
  it("pins hair and the four palette colors", () => {
    expect(toMicahOptions(base)).toMatchObject({
      seed: "seed-1",
      hairVariant: ["pixie"],
      hairProbability: 100,
      hairColor: [HAIR_COLOR_HEX.brown],
      baseColor: [SKIN_COLOR_HEX.tan],
      shirtColor: [SHIRT_COLOR_HEX.teal],
      backgroundColor: [BACKGROUND_COLOR_HEX.cream],
    });
  });

  it("switches every accessory off when absent", () => {
    const options = toMicahOptions(base);
    expect(options).toMatchObject({
      glassesProbability: 0,
      earringsProbability: 0,
      facialHairProbability: 0,
    });
    expect(options).not.toHaveProperty("glassesVariant");
    expect(options).not.toHaveProperty("earringsVariant");
    expect(options).not.toHaveProperty("facialHairVariant");
  });

  it("pins accessories that are present", () => {
    const options = toMicahOptions({
      ...base,
      glasses: "square",
      earrings: "hoop",
      facialHair: "scruff",
    });
    expect(options).toMatchObject({
      glassesProbability: 100,
      glassesVariant: ["square"],
      earringsProbability: 100,
      earringsVariant: ["hoop"],
      facialHairProbability: 100,
      facialHairVariant: ["scruff"],
    });
  });
});

describe("what DiceBear actually resolves", () => {
  const style = new Style(micah);

  it("never adds an accessory the user did not pick, whatever the seed", () => {
    for (let i = 0; i < 30; i++) {
      const resolved = new Avatar(style, toMicahOptions({ ...base, seed: `s${i}` })).toJSON()
        .options;
      expect(resolved.glassesVariant).toBeUndefined();
      expect(resolved.earringsVariant).toBeUndefined();
      expect(resolved.facialHairVariant).toBeUndefined();
      expect(resolved.hairVariant).toBe("pixie");
    }
  });

  it("keeps a chosen accessory for every seed", () => {
    for (let i = 0; i < 30; i++) {
      const resolved = new Avatar(
        style,
        toMicahOptions({ ...base, seed: `s${i}`, glasses: "round" }),
      ).toJSON().options;
      expect(resolved.glassesVariant).toBe("round");
    }
  });
});

describe("avatarDataUri", () => {
  const svgOf = (config: AvatarConfig) => {
    const uri = avatarDataUri(config);
    return decodeURIComponent(uri.slice(uri.indexOf(",") + 1)).toLowerCase();
  };

  it("returns a local SVG data URI in the chosen colors, with no script", () => {
    expect(avatarDataUri(base)).toMatch(/^data:image\/svg\+xml/);
    const svg = svgOf(base);
    for (const hex of [
      HAIR_COLOR_HEX.brown,
      SKIN_COLOR_HEX.tan,
      SHIRT_COLOR_HEX.teal,
      BACKGROUND_COLOR_HEX.cream,
    ]) {
      expect(svg).toContain(hex.toLowerCase());
    }
    expect(svg).not.toContain("<script");
  });

  it("is stable for equal configs and changes with hair and accessories", () => {
    expect(avatarDataUri({ ...base })).toBe(avatarDataUri(base));
    expect(avatarDataUri({ ...base, hair: "mrClean" })).not.toBe(avatarDataUri(base));
    expect(avatarDataUri({ ...base, glasses: "round" })).not.toBe(avatarDataUri(base));
  });

  it("reconstructs the same avatar from persisted JSON", () => {
    const saved = JSON.parse(JSON.stringify({ ...base, earrings: "stud" }));
    expect(avatarDataUri(resolveAvatar(saved, "any-user"))).toBe(
      avatarDataUri({ ...base, earrings: "stud" }),
    );
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/types/avatar.test.ts src/lib`
Expected: FAIL (modules `./generate`, `./schema`, `./resolve`, `./micah` missing / exports missing).

- [ ] **Step 5: Rewrite the types**

`src/types/avatar.ts` (replace the whole file):

```ts
/** DiceBear "Micah" avatar configuration and the curated palettes a user picks
 * from. Colors are stored as palette ids (not hex) so the palettes can be
 * re-tuned later without a data migration — see src/lib/avatar-palette.ts for
 * the id → hex maps and src/lib/avatar/micah.ts for how a config is rendered.
 *
 * The variant lists below mirror the installed @dicebear/styles Micah
 * definition; src/lib/avatar/micah.test.ts fails if a DiceBear upgrade drifts. */
export const HAIR_STYLES = [
  "full",
  "pixie",
  "fonze",
  "dougFunny",
  "dannyPhantom",
  "mrT",
  "mrClean",
  "turban",
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const GLASSES_VARIANTS = ["round", "square"] as const;
export type GlassesVariant = (typeof GLASSES_VARIANTS)[number];

export const EARRINGS_VARIANTS = ["hoop", "stud"] as const;
export type EarringsVariant = (typeof EARRINGS_VARIANTS)[number];

export const FACIAL_HAIR_VARIANTS = ["beard", "scruff"] as const;
export type FacialHairVariant = (typeof FACIAL_HAIR_VARIANTS)[number];

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
  provider: "dicebear";
  style: "micah";
  version: 1;
  /** Drives the features the user can't edit (eyes, brows, mouth, nose, ears, clothes). */
  seed: string;
  hair: HairStyle;
  hairColor: HairColorId;
  skinColor: SkinColorId;
  shirtColor: ShirtColorId;
  backgroundColor: BackgroundColorId;
  /** Absent means "none" for each of the three accessories. */
  glasses?: GlassesVariant;
  earrings?: EarringsVariant;
  facialHair?: FacialHairVariant;
}
```

- [ ] **Step 6: Write the schema**

`src/lib/avatar/schema.ts`:

```ts
import { z } from "zod";

import {
  BACKGROUND_COLORS,
  EARRINGS_VARIANTS,
  FACIAL_HAIR_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_COLORS,
} from "@/types";

/** The single validator for an avatar: used to validate form input before
 * saving and to decide whether a stored value can still be rendered. Unknown
 * keys are stripped, so a parsed value is always exactly an `AvatarConfig`. */
export const avatarConfigSchema = z.object({
  provider: z.literal("dicebear"),
  style: z.literal("micah"),
  version: z.literal(1),
  seed: z.string().min(1).max(64),
  hair: z.enum(HAIR_STYLES),
  hairColor: z.enum(HAIR_COLORS),
  skinColor: z.enum(SKIN_COLORS),
  shirtColor: z.enum(SHIRT_COLORS),
  backgroundColor: z.enum(BACKGROUND_COLORS),
  glasses: z.enum(GLASSES_VARIANTS).optional(),
  earrings: z.enum(EARRINGS_VARIANTS).optional(),
  facialHair: z.enum(FACIAL_HAIR_VARIANTS).optional(),
});
```

- [ ] **Step 7: Write generate and resolve**

`src/lib/avatar/generate.ts`:

```ts
import {
  BACKGROUND_COLORS,
  EARRINGS_VARIANTS,
  FACIAL_HAIR_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_COLORS,
  type AvatarConfig,
} from "@/types";

/** Returns floats in [0, 1) — `Math.random` in production, a stub in tests. */
export type Rng = () => number;

/** Chance that each accessory is present in a random ("Surprise me") avatar. */
const ACCESSORY_CHANCE = 0.3;

/** FNV-1a, 32-bit: a tiny stable string hash. */
function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a tiny seedable PRNG. */
function mulberry32(seed: number): Rng {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function buildAvatar(seed: string, rng: Rng, withAccessories: boolean): AvatarConfig {
  const avatar: AvatarConfig = {
    provider: "dicebear",
    style: "micah",
    version: 1,
    seed,
    hair: pick(HAIR_STYLES, rng),
    hairColor: pick(HAIR_COLORS, rng),
    skinColor: pick(SKIN_COLORS, rng),
    shirtColor: pick(SHIRT_COLORS, rng),
    backgroundColor: pick(BACKGROUND_COLORS, rng),
  };
  if (withAccessories) {
    if (rng() < ACCESSORY_CHANCE) avatar.glasses = pick(GLASSES_VARIANTS, rng);
    if (rng() < ACCESSORY_CHANCE) avatar.earrings = pick(EARRINGS_VARIANTS, rng);
    if (rng() < ACCESSORY_CHANCE) avatar.facialHair = pick(FACIAL_HAIR_VARIANTS, rng);
  }
  return avatar;
}

/** The avatar shown for a user who has no valid stored config: fully determined
 * by their id (the id is the seed), never has accessories. */
export function defaultAvatarFor(userId: string): AvatarConfig {
  return buildAvatar(userId, mulberry32(hash32(userId)), false);
}

/** A valid random combination for the "Surprise me" button. */
export function randomAvatar(rng: Rng = Math.random): AvatarConfig {
  const seed = Math.floor(rng() * 2 ** 32).toString(36);
  return buildAvatar(seed, rng, true);
}
```

`src/lib/avatar/resolve.ts`:

```ts
import type { AvatarConfig } from "@/types";

import { defaultAvatarFor } from "./generate";
import { avatarConfigSchema } from "./schema";

/** Tolerant read of a stored avatar. Anything that isn't a valid current-version
 * config — null, the legacy 10-character shape, an unknown version, corrupt
 * JSON — resolves to the user's deterministic default instead of throwing. */
export function resolveAvatar(raw: unknown, userId: string): AvatarConfig {
  const parsed = avatarConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultAvatarFor(userId);
}
```

- [ ] **Step 8: Write the Micah renderer**

`src/lib/avatar/micah.ts`:

```ts
import { Avatar, Style, type StyleOptions } from "@dicebear/core";
import micah from "@dicebear/styles/micah.json";

import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import type { AvatarConfig } from "@/types";

type MicahOptions = StyleOptions<typeof micah>;

/** Reused for every avatar; passing a raw definition to `Avatar` is deprecated. */
const style = new Style(micah);

/** Intrinsic SVG size. The image is scaled with CSS, so every avatar shares one
 * rendering (and one cache entry) whatever size it is displayed at. */
const RENDER_SIZE = 128;

/** Maps a saved config to DiceBear options. Everything the user chose is pinned;
 * accessories they did not choose get probability 0 so the seed can never add
 * glasses, earrings or facial hair on its own. */
export function toMicahOptions(config: AvatarConfig): MicahOptions {
  return {
    seed: config.seed,
    size: RENDER_SIZE,
    hairVariant: [config.hair],
    hairProbability: 100,
    hairColor: [HAIR_COLOR_HEX[config.hairColor]],
    baseColor: [SKIN_COLOR_HEX[config.skinColor]],
    shirtColor: [SHIRT_COLOR_HEX[config.shirtColor]],
    backgroundColor: [BACKGROUND_COLOR_HEX[config.backgroundColor]],
    glassesProbability: config.glasses ? 100 : 0,
    ...(config.glasses ? { glassesVariant: [config.glasses] } : {}),
    earringsProbability: config.earrings ? 100 : 0,
    ...(config.earrings ? { earringsVariant: [config.earrings] } : {}),
    facialHairProbability: config.facialHair ? 100 : 0,
    ...(config.facialHair ? { facialHairVariant: [config.facialHair] } : {}),
  };
}

const CACHE_LIMIT = 256;
const cache = new Map<string, string>();

/** The avatar as an `image/svg+xml` data URI, rendered locally. Safe to use as an
 * `<img src>`: an SVG loaded as an image cannot run scripts. */
export function avatarDataUri(config: AvatarConfig): string {
  const key = JSON.stringify(config);
  const hit = cache.get(key);
  if (hit) return hit;
  const uri = new Avatar(style, toMicahOptions(config)).toDataUri();
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, uri);
  return uri;
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/types/avatar.test.ts src/lib`
Expected: PASS (all of generate, resolve, micah, avatar-palette, avatar constants). If `micah.test.ts` reports a variant-list drift, fix the constant in `src/types/avatar.ts` to match the installed definition. (Importing `@dicebear/styles/micah.json` under Vitest 5 was verified to work with no config change; the package's `exports` map only offers `types`/`default` conditions.)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/types/avatar.ts src/types/avatar.test.ts src/lib/avatar src/lib/avatar-palette.test.ts
git commit -m "feat(avatar): add DiceBear Micah config, resolve and rendering library" -m "Typecheck is red in unmigrated consumers until the UI/persistence tasks land." -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ"
```

---

### Task 2: Persistence — validation, form parsing and tolerant reads

**Files:**
- Modify: `src/server/actions/schemas.ts`, `src/server/actions/profile.ts`, `src/server/auth/session.ts`, `src/server/repositories/memberships.ts`, `src/server/repositories/knowledge.ts`, `src/server/services/profile-service.ts`
- Modify tests: `src/server/actions/schemas.test.ts`, `src/server/services/profile-service.test.ts`
- Create test: `src/server/actions/profile.test.ts`

**Interfaces:**
- Consumes: `avatarConfigSchema`, `resolveAvatar`, `defaultAvatarFor` from Task 1.
- Produces: form contract — the profile form posts a single field `avatar` containing `JSON.stringify(AvatarConfig)`; `getProfileDetails().avatar` and every `UserSummary.avatar` for an existing profile row is a valid `AvatarConfig`.

- [ ] **Step 1: Write / update the failing tests**

In `src/server/actions/schemas.test.ts`: add `import { defaultAvatarFor } from "@/lib/avatar/generate";` with the other imports, then replace the whole `describe("profileFieldsSchema", …)` block with:

```ts
describe("profileFieldsSchema", () => {
  const avatar = defaultAvatarFor("user-1");

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

  it("accepts an avatar with accessories", () => {
    const result = profileFieldsSchema.safeParse({
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar: { ...avatar, glasses: "round", earrings: "stud", facialHair: "beard" },
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

  it.each([
    ["an unknown hair style", { ...avatar, hair: "robot" }],
    ["an off-palette color id", { ...avatar, shirtColor: "#ff00ff" }],
    ["an unknown accessory", { ...avatar, glasses: "monocle" }],
    ["an unsupported version", { ...avatar, version: 2 }],
    ["the legacy character shape", { character: "girl-1", skinColor: "tan", hairColor: "black", shirtColor: "teal", backgroundColor: "cream" }],
  ])("rejects %s", (_name, badAvatar) => {
    const result = profileFieldsSchema.safeParse({
      fullName: "Jamie Vos",
      nickname: "Jamie",
      avatar: badAvatar,
    });
    expect(result.success).toBe(false);
  });
});
```

Create `src/server/actions/profile.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/server/services/profile-service", () => ({
  completeOnboarding: vi.fn(),
  updateProfileDetails: vi.fn(),
}));

import { revalidatePath } from "next/cache";

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { completeOnboarding, updateProfileDetails } from "@/server/services/profile-service";

import { completeOnboardingAction, updateProfileAction } from "./profile";

const avatar = { ...defaultAvatarFor("u1"), glasses: "round" as const };

function form(overrides: Record<string, string | null> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string | null> = {
    fullName: "Jamie Vos",
    nickname: "Jamie",
    avatar: JSON.stringify(avatar),
    cefrLevel: "A2",
    learningGoal: "relocating",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) data.set(key, value);
  }
  return data;
}

const saved = {
  fullName: "Jamie Vos",
  nickname: "Jamie",
  avatar,
  cefrLevel: "A2",
  learningGoal: "relocating",
};

describe("updateProfileAction", () => {
  it("saves the structured avatar config posted as JSON", async () => {
    const result = await updateProfileAction(undefined, form());
    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateProfileDetails).toHaveBeenCalledWith(saved);
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it.each([
    ["missing", null],
    ["not JSON", "not json"],
    ["an unknown hair style", JSON.stringify({ ...avatar, hair: "nope" })],
    [
      "the legacy shape",
      JSON.stringify({ character: "girl-1", skinColor: "tan", hairColor: "black", shirtColor: "teal", backgroundColor: "cream" }),
    ],
  ])("rejects an avatar that is %s", async (_name, value) => {
    const result = await updateProfileAction(undefined, form({ avatar: value }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(updateProfileDetails).not.toHaveBeenCalled();
  });
});

describe("completeOnboardingAction", () => {
  it("saves the avatar, then redirects to /today", async () => {
    await expect(completeOnboardingAction(undefined, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(completeOnboarding).toHaveBeenCalledWith(saved);
  });

  it("does not save an invalid avatar", async () => {
    const result = await completeOnboardingAction(undefined, form({ avatar: "not json" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(completeOnboarding).not.toHaveBeenCalled();
  });
});
```

In `src/server/services/profile-service.test.ts`: replace `import { DEFAULT_AVATAR, type ProfileFields } from "@/types";` with

```ts
import { defaultAvatarFor } from "@/lib/avatar/generate";
import type { ProfileFields } from "@/types";
```

replace `avatar: DEFAULT_AVATAR,` in `fields` with `avatar: defaultAvatarFor("u1"),`, and replace the whole `describe("getProfileDetails", …)` block with:

```ts
describe("getProfileDetails", () => {
  const row = {
    id: "u1",
    fullName: "Jamie Vos",
    nickname: "Jamie",
    avatar: null as unknown,
    cefrLevel: null,
    learningGoal: null,
    onboardedAt: new Date(),
    createdAt: new Date(),
  };

  it("falls back to the deterministic default avatar when none is stored", async () => {
    vi.mocked(getProfile).mockResolvedValue(row as never);
    const details = await getProfileDetails();
    expect(details.avatar).toEqual(defaultAvatarFor("u1"));
  });

  it("falls back for a legacy avatar shape instead of breaking", async () => {
    vi.mocked(getProfile).mockResolvedValue({
      ...row,
      avatar: { character: "girl-1", skinColor: "tan", hairColor: "black", shirtColor: "teal", backgroundColor: "cream" },
    } as never);
    const details = await getProfileDetails();
    expect(details.avatar).toEqual(defaultAvatarFor("u1"));
  });

  it("returns a valid stored avatar as saved", async () => {
    const stored = { ...defaultAvatarFor("someone-else"), glasses: "square" as const };
    vi.mocked(getProfile).mockResolvedValue({ ...row, avatar: stored } as never);
    const details = await getProfileDetails();
    expect(details.avatar).toEqual(stored);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/server/actions/schemas.test.ts src/server/actions/profile.test.ts src/server/services/profile-service.test.ts`
Expected: FAIL (old schema/action still expects the character shape; service still returns `DEFAULT_AVATAR` which no longer exists).

- [ ] **Step 3: Implement**

`src/server/actions/schemas.ts`: replace the top import block

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

with

```ts
import { avatarConfigSchema } from "@/lib/avatar/schema";
import { CEFR_LEVELS, KNOWLEDGE_TYPES, LEARNING_GOALS } from "@/types";
```

and delete the local `export const avatarConfigSchema = z.object({ … });` block (the one with `character`, `skinColor`, …). `profileFieldsSchema` keeps `avatar: avatarConfigSchema`. Then run `grep -rn "avatarConfigSchema" src` and confirm no other file imported it from `schemas.ts`.

`src/server/actions/profile.ts`: replace `profileFieldsFromFormData` with:

```ts
/** The avatar travels as one JSON field. Anything unparseable becomes
 * `undefined`, which the schema then rejects as a normal validation error. */
function avatarFromFormData(formData: FormData): unknown {
  const raw = formData.get("avatar");
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function profileFieldsFromFormData(formData: FormData): unknown {
  const cefrLevel = formData.get("cefrLevel");
  const learningGoal = formData.get("learningGoal");
  return {
    fullName: formData.get("fullName"),
    nickname: formData.get("nickname"),
    avatar: avatarFromFormData(formData),
    cefrLevel: cefrLevel ? cefrLevel : null,
    learningGoal: learningGoal ? learningGoal : null,
  };
}
```

`src/server/auth/session.ts`: add `import { resolveAvatar } from "@/lib/avatar/resolve";` (above the `@/server/repositories/profiles` import) and change `avatar: profile.avatar,` to `avatar: resolveAvatar(profile.avatar, authUser.id),`.

`src/server/repositories/memberships.ts`: add `import { resolveAvatar } from "@/lib/avatar/resolve";` (above `@/server/db/client`) and change `avatar: r.avatar,` to `avatar: resolveAvatar(r.avatar, r.id),`.

`src/server/repositories/knowledge.ts`: add `import { resolveAvatar } from "@/lib/avatar/resolve";` with the other `@/lib/...` imports (keep import order consistent with the file) and in `toUserSummary` change `avatar: p.avatar,` to `avatar: resolveAvatar(p.avatar, p.id),`.

`src/server/services/profile-service.ts`: replace the imports/usage:

```ts
import { resolveAvatar } from "@/lib/avatar/resolve";
import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getProfile, markOnboarded, updateProfile } from "@/server/repositories/profiles";
import type { CEFRLevel, LearningGoal, ProfileFields } from "@/types";
```

and `avatar: profile.avatar ?? DEFAULT_AVATAR,` → `avatar: resolveAvatar(profile.avatar, userId),`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/server/actions/schemas.test.ts src/server/actions/profile.test.ts src/server/services/profile-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server
git commit -m "feat(avatar): validate JSON avatar config and resolve stored avatars tolerantly" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ"
```

---

### Task 3: The reusable `Avatar` component (and removing the old characters)

**Files:**
- Rewrite: `src/components/ui/avatar.tsx`, `src/components/ui/avatar.test.tsx`
- Delete: `src/components/ui/avatar-characters/` (whole directory)

**Interfaces:**
- Consumes: `avatarDataUri` (Task 1), `defaultAvatarFor` (tests only).
- Produces: `Avatar` with the **unchanged public props** `{ avatar: AvatarConfig | null; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?; "aria-label"? …span props }`. `xl` is new (`size-20` below `md`, `size-32` from `md`).

- [ ] **Step 1: Confirm nothing else uses the old characters**

Run: `grep -rn "avatar-characters\|AVATAR_CHARACTER_COMPONENTS" src`
Expected: matches only in `src/components/ui/avatar.tsx`, `src/features/onboarding/avatar-builder.tsx` (rewritten in Task 4), and the directory itself. If anything else appears, stop and report it.

- [ ] **Step 2: Write the failing test**

`src/components/ui/avatar.test.tsx` (replace the file):

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { avatarDataUri } from "@/lib/avatar/micah";

import { Avatar } from "./avatar";

const config = { ...defaultAvatarFor("user-1"), glasses: "round" as const };

describe("Avatar", () => {
  it("renders the saved config as a local SVG data-URI image", () => {
    const { container } = render(<Avatar avatar={config} />);
    const img = container.querySelector("img")!;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe(avatarDataUri(config));
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(img).toHaveAttribute("alt", "");
  });

  it("is decorative unless it has a label", () => {
    const { container } = render(<Avatar avatar={config} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes an image role and label when it stands alone", () => {
    const { getByRole } = render(<Avatar avatar={config} aria-label="Jamie" />);
    expect(getByRole("img", { name: "Jamie" })).toBeInTheDocument();
  });

  it("renders a neutral placeholder (no image) when avatar is null", () => {
    const { container, getByLabelText } = render(<Avatar avatar={null} aria-label="Jamie" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(getByLabelText("Jamie")).toBeInTheDocument();
  });

  it("supports the xl preview size", () => {
    const { container } = render(<Avatar avatar={config} size="xl" />);
    expect(container.firstElementChild).toHaveClass("md:size-32");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/ui/avatar.test.tsx`
Expected: FAIL (old component renders SVG characters, no `<img>`).

- [ ] **Step 4: Implement and delete the old code**

`src/components/ui/avatar.tsx` (replace the file):

```tsx
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
```

Then: `git rm -r src/components/ui/avatar-characters`

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/ui/avatar.test.tsx`
Expected: PASS. (`avatar-builder` still references deleted code until Task 4; do not run the whole suite yet.)

- [ ] **Step 6: Commit**

```bash
git add -A src/components/ui
git commit -m "feat(avatar): render avatars from DiceBear Micah and drop the old characters" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ"
```

---

### Task 4: The avatar builder (option rows, Surprise me, i18n, credit)

**Files:**
- Create: `src/features/onboarding/avatar-option-group.tsx`
- Rewrite: `src/features/onboarding/avatar-builder.tsx`, `src/features/onboarding/avatar-builder.test.tsx`
- Modify: `src/messages/en.json`, `src/messages/nl.json` (`onboarding.avatar` block)

**Interfaces:**
- Consumes: `Avatar` (Task 3), `randomAvatar` (Task 1), palettes hex maps, `Button`, `VisuallyHidden` (`@/components/ui/visually-hidden`).
- Produces: `AvatarBuilder({ value: AvatarConfig; onChange: (next: AvatarConfig) => void })` (same signature as before). `AvatarOptionGroup<Id extends string>({ legend, options, value, onChange, variant })`.

- [ ] **Step 1: Add the i18n strings**

In `src/messages/en.json`, replace the `"avatar": { … }` object inside `"onboarding"` (currently `character`, `skinColor`, `hairColor`, `shirtColor`, `backgroundColor`) with:

```json
    "avatar": {
      "preview": "Your avatar",
      "surpriseMe": "Surprise me",
      "none": "None",
      "groups": {
        "hair": "Hairstyle",
        "hairColor": "Hair color",
        "skinColor": "Skin",
        "shirtColor": "Shirt",
        "backgroundColor": "Background",
        "glasses": "Glasses",
        "earrings": "Earrings",
        "facialHair": "Facial hair"
      },
      "hair": {
        "full": "Long waves",
        "pixie": "Shoulder length",
        "fonze": "Quiff",
        "dougFunny": "Tufts",
        "dannyPhantom": "Bangs",
        "mrT": "Flat top",
        "mrClean": "Bald",
        "turban": "Side sweep"
      },
      "glasses": { "round": "Round", "square": "Square" },
      "earrings": { "hoop": "Hoops", "stud": "Studs" },
      "facialHair": { "beard": "Beard", "scruff": "Stubble" },
      "colors": {
        "porcelain": "Porcelain",
        "ivory": "Ivory",
        "tan": "Tan",
        "almond": "Almond",
        "brown": "Brown",
        "deep": "Deep",
        "black": "Black",
        "dark-brown": "Dark brown",
        "chestnut": "Chestnut",
        "blonde": "Blonde",
        "ginger": "Ginger",
        "gray": "Gray",
        "pink": "Pink",
        "teal": "Teal",
        "coral": "Coral",
        "sunflower": "Sunflower",
        "sky": "Sky",
        "grape": "Grape",
        "mint": "Mint",
        "slate": "Slate",
        "rose": "Rose",
        "cream": "Cream",
        "blush": "Blush",
        "lilac": "Lilac",
        "sand": "Sand"
      },
      "creditPrefix": "Avatar art:"
    },
```

In `src/messages/nl.json`, replace the same object with:

```json
    "avatar": {
      "preview": "Jouw avatar",
      "surpriseMe": "Verras me",
      "none": "Geen",
      "groups": {
        "hair": "Kapsel",
        "hairColor": "Haarkleur",
        "skinColor": "Huidskleur",
        "shirtColor": "Shirtkleur",
        "backgroundColor": "Achtergrond",
        "glasses": "Bril",
        "earrings": "Oorbellen",
        "facialHair": "Gezichtsbeharing"
      },
      "hair": {
        "full": "Lange golven",
        "pixie": "Schouderlang",
        "fonze": "Kuif",
        "dougFunny": "Plukjes",
        "dannyPhantom": "Pony",
        "mrT": "Platte top",
        "mrClean": "Kaal",
        "turban": "Zijwaarts"
      },
      "glasses": { "round": "Rond", "square": "Vierkant" },
      "earrings": { "hoop": "Ringen", "stud": "Knopjes" },
      "facialHair": { "beard": "Baard", "scruff": "Stoppels" },
      "colors": {
        "porcelain": "Porselein",
        "ivory": "Ivoor",
        "tan": "Getint",
        "almond": "Amandel",
        "brown": "Bruin",
        "deep": "Donker",
        "black": "Zwart",
        "dark-brown": "Donkerbruin",
        "chestnut": "Kastanje",
        "blonde": "Blond",
        "ginger": "Rood",
        "gray": "Grijs",
        "pink": "Roze",
        "teal": "Blauwgroen",
        "coral": "Koraal",
        "sunflower": "Zonnebloem",
        "sky": "Hemelblauw",
        "grape": "Druif",
        "mint": "Munt",
        "slate": "Leisteen",
        "rose": "Framboos",
        "cream": "Crème",
        "blush": "Zachtroze",
        "lilac": "Lila",
        "sand": "Zand"
      },
      "creditPrefix": "Avatarkunst:"
    },
```

Validate both files parse: `node -e "JSON.parse(require('fs').readFileSync('src/messages/en.json','utf8'));JSON.parse(require('fs').readFileSync('src/messages/nl.json','utf8'));console.log('ok')"` → `ok`.

- [ ] **Step 2: Write the failing builder tests**

`src/features/onboarding/avatar-builder.test.tsx` (replace the file):

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { avatarConfigSchema } from "@/lib/avatar/schema";
import type { AvatarConfig } from "@/types";

import { AvatarBuilder } from "./avatar-builder";

// Fully explicit so no test below clicks an already-selected radio (which fires
// no change event) and the default has no accessories.
const config: AvatarConfig = {
  ...defaultAvatarFor("user-1"),
  hair: "full",
  hairColor: "black",
  skinColor: "porcelain",
  shirtColor: "teal",
  backgroundColor: "cream",
};

function renderBuilder(value: AvatarConfig = config) {
  const onChange = vi.fn();
  render(<AvatarBuilder value={value} onChange={onChange} />);
  const group = (name: string) => within(screen.getByRole("group", { name }));
  return { onChange, group };
}

describe("AvatarBuilder", () => {
  it("shows a labelled live preview", () => {
    renderBuilder();
    expect(screen.getByRole("img", { name: "preview" })).toBeInTheDocument();
  });

  it("offers every choice as a radio in a labelled group, with the current one checked", () => {
    const { group } = renderBuilder();
    expect(group("groups.hair").getAllByRole("radio")).toHaveLength(8);
    expect(group("groups.hair").getByRole("radio", { name: "hair.full" })).toBeChecked();
    expect(group("groups.skinColor").getAllByRole("radio")).toHaveLength(6);
    expect(group("groups.glasses").getByRole("radio", { name: "none" })).toBeChecked();
  });

  it("changes the hairstyle", async () => {
    const { onChange, group } = renderBuilder();
    await userEvent.click(group("groups.hair").getByRole("radio", { name: "hair.pixie" }));
    expect(onChange).toHaveBeenCalledWith({ ...config, hair: "pixie" });
  });

  it("changes each color independently", async () => {
    const { onChange, group } = renderBuilder();
    await userEvent.click(group("groups.hairColor").getByRole("radio", { name: "colors.blonde" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...config, hairColor: "blonde" });
    await userEvent.click(group("groups.skinColor").getByRole("radio", { name: "colors.deep" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...config, skinColor: "deep" });
    await userEvent.click(group("groups.shirtColor").getByRole("radio", { name: "colors.coral" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...config, shirtColor: "coral" });
    await userEvent.click(
      group("groups.backgroundColor").getByRole("radio", { name: "colors.lilac" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ ...config, backgroundColor: "lilac" });
  });

  it("adds an accessory", async () => {
    const { onChange, group } = renderBuilder();
    await userEvent.click(group("groups.glasses").getByRole("radio", { name: "glasses.round" }));
    expect(onChange).toHaveBeenCalledWith({ ...config, glasses: "round" });
  });

  it("removes an accessory with None, leaving the others untouched", async () => {
    const { onChange, group } = renderBuilder({ ...config, glasses: "round", facialHair: "beard" });
    expect(group("groups.glasses").getByRole("radio", { name: "glasses.round" })).toBeChecked();
    await userEvent.click(group("groups.glasses").getByRole("radio", { name: "none" }));
    const next = onChange.mock.calls[0][0] as AvatarConfig;
    expect(next).not.toHaveProperty("glasses");
    expect(next.facialHair).toBe("beard");
  });

  it("Surprise me produces a valid, different avatar", async () => {
    const { onChange } = renderBuilder();
    await userEvent.click(screen.getByRole("button", { name: /surpriseMe/ }));
    const next = onChange.mock.calls[0][0];
    expect(avatarConfigSchema.safeParse(next).success).toBe(true);
    expect(next).not.toEqual(config);
  });

  it("credits Micah under CC BY 4.0", () => {
    renderBuilder();
    expect(screen.getByRole("link", { name: "Micah Lanier" })).toHaveAttribute(
      "href",
      "https://dribbble.com/micahlanier",
    );
    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });
});
```

Note: `screen.getByRole("group", { name })` resolves to `<fieldset>` + `<legend>`; the same color id (`brown`, `mint`, `sky`) appears in more than one row, which is why every lookup is scoped with `within(group)`.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/features/onboarding/avatar-builder.test.tsx`
Expected: FAIL (old builder).

- [ ] **Step 4: Implement the option-group primitive**

`src/features/onboarding/avatar-option-group.tsx`:

```tsx
"use client";

import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";

import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/utils/cn";

export interface AvatarOption<Id extends string> {
  id: Id;
  /** Accessible name — always the translated label, never shown as text. */
  label: string;
  /** Visual content for a `tile` (a thumbnail avatar or an icon). */
  content?: ReactNode;
  /** Fill for a `swatch` (a palette hex). */
  color?: string;
}

/**
 * One row of avatar choices: a labelled group of visually-hidden native radio
 * inputs. The platform provides the tab stop, arrow-key navigation and checked
 * state; the styled tile beside each input shows selected / hover / keyboard-focus.
 * Hover and press motion only run under `motion-safe`.
 */
export function AvatarOptionGroup<Id extends string>({
  legend,
  options,
  value,
  onChange,
  variant,
}: {
  legend: string;
  options: readonly AvatarOption<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  variant: "tile" | "swatch";
}) {
  const name = useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-label font-medium text-fg-secondary">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.id === value;
          return (
            <label key={option.id} className="relative cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                onChange={() => onChange(option.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "grid place-items-center overflow-hidden rounded-pill border-2 border-border bg-surface-sunken",
                  "transition-[transform,box-shadow,border-color] duration-150",
                  "hover:shadow-card motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95",
                  "peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary/25",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-border-focus",
                  variant === "tile" ? "size-14 sm:size-16" : "size-9 sm:size-10",
                )}
                style={option.color ? { backgroundColor: option.color } : undefined}
              >
                {option.content}
              </span>
              {checked ? (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-pill bg-primary text-on-primary shadow-card"
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : null}
              <VisuallyHidden>{option.label}</VisuallyHidden>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 5: Implement the builder**

`src/features/onboarding/avatar-builder.tsx` (replace the file):

```tsx
"use client";

import { Ban, Dices } from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, Button } from "@/components/ui";
import { randomAvatar } from "@/lib/avatar/generate";
import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "@/lib/avatar-palette";
import {
  BACKGROUND_COLORS,
  EARRINGS_VARIANTS,
  FACIAL_HAIR_VARIANTS,
  GLASSES_VARIANTS,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_COLORS,
  type AvatarConfig,
} from "@/types";

import { AvatarOptionGroup, type AvatarOption } from "./avatar-option-group";

type AccessoryKey = "glasses" | "earrings" | "facialHair";
const NONE = "none";

/** Sets an accessory, or removes the key entirely for "none" so the saved JSON
 * only ever contains accessories the user actually picked. */
function withAccessory<K extends AccessoryKey>(
  config: AvatarConfig,
  key: K,
  choice: NonNullable<AvatarConfig[K]> | typeof NONE,
): AvatarConfig {
  const next: AvatarConfig = { ...config };
  if (choice === NONE) delete next[key];
  else next[key] = choice as AvatarConfig[K];
  return next;
}

export function AvatarBuilder({
  value,
  onChange,
}: {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}) {
  const t = useTranslations("onboarding.avatar");

  /** A thumbnail is the current avatar with one field swapped, so what you see
   * on the tile is what you get. */
  const thumb = (patch: Partial<AvatarConfig>) => (
    <Avatar avatar={{ ...value, ...patch }} className="size-full" />
  );
  const noneTile = <Ban className="size-1/2 text-fg-muted" strokeWidth={1.75} aria-hidden />;

  const hairOptions: AvatarOption<AvatarConfig["hair"]>[] = HAIR_STYLES.map((hair) => ({
    id: hair,
    label: t(`hair.${hair}`),
    content: thumb({ hair }),
  }));

  const accessoryOptions = <K extends AccessoryKey>(
    key: K,
    variants: readonly NonNullable<AvatarConfig[K]>[],
  ): AvatarOption<NonNullable<AvatarConfig[K]> | typeof NONE>[] => [
    { id: NONE, label: t("none"), content: noneTile },
    ...variants.map((variant) => ({
      id: variant,
      label: t(`${key}.${variant}`),
      content: thumb({ [key]: variant }),
    })),
  ];

  const swatches = <Id extends string>(
    ids: readonly Id[],
    hex: Record<Id, string>,
  ): AvatarOption<Id>[] =>
    ids.map((id) => ({ id, label: t(`colors.${id}`), color: hex[id] }));

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 flex items-center justify-center gap-4 bg-surface py-3 md:static md:flex-col md:py-0">
        <Avatar avatar={value} size="xl" aria-label={t("preview")} />
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(randomAvatar())}>
          <Dices className="size-4" aria-hidden />
          {t("surpriseMe")}
        </Button>
      </div>

      <AvatarOptionGroup
        legend={t("groups.hair")}
        options={hairOptions}
        value={value.hair}
        onChange={(hair) => onChange({ ...value, hair })}
        variant="tile"
      />
      <AvatarOptionGroup
        legend={t("groups.hairColor")}
        options={swatches(HAIR_COLORS, HAIR_COLOR_HEX)}
        value={value.hairColor}
        onChange={(hairColor) => onChange({ ...value, hairColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.skinColor")}
        options={swatches(SKIN_COLORS, SKIN_COLOR_HEX)}
        value={value.skinColor}
        onChange={(skinColor) => onChange({ ...value, skinColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.shirtColor")}
        options={swatches(SHIRT_COLORS, SHIRT_COLOR_HEX)}
        value={value.shirtColor}
        onChange={(shirtColor) => onChange({ ...value, shirtColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.backgroundColor")}
        options={swatches(BACKGROUND_COLORS, BACKGROUND_COLOR_HEX)}
        value={value.backgroundColor}
        onChange={(backgroundColor) => onChange({ ...value, backgroundColor })}
        variant="swatch"
      />
      <AvatarOptionGroup
        legend={t("groups.glasses")}
        options={accessoryOptions("glasses", GLASSES_VARIANTS)}
        value={value.glasses ?? NONE}
        onChange={(choice) => onChange(withAccessory(value, "glasses", choice))}
        variant="tile"
      />
      <AvatarOptionGroup
        legend={t("groups.earrings")}
        options={accessoryOptions("earrings", EARRINGS_VARIANTS)}
        value={value.earrings ?? NONE}
        onChange={(choice) => onChange(withAccessory(value, "earrings", choice))}
        variant="tile"
      />
      <AvatarOptionGroup
        legend={t("groups.facialHair")}
        options={accessoryOptions("facialHair", FACIAL_HAIR_VARIANTS)}
        value={value.facialHair ?? NONE}
        onChange={(choice) => onChange(withAccessory(value, "facialHair", choice))}
        variant="tile"
      />

      <p className="text-caption text-fg-muted">
        {t("creditPrefix")}{" "}
        <a
          href="https://dribbble.com/micahlanier"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-fg-secondary"
        >
          Micah Lanier
        </a>
        {" · "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-fg-secondary"
        >
          CC BY 4.0
        </a>
        {" · "}
        <a
          href="https://www.dicebear.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-fg-secondary"
        >
          DiceBear
        </a>
      </p>
    </div>
  );
}
```

If TypeScript complains about the computed key in `thumb({ [key]: variant })` (a computed key with a generic `K` widens to `{ [x: string]: … }`), replace that one call with an explicit cast: `thumb({ [key]: variant } as Partial<AvatarConfig>)`. Do not change the runtime behavior.

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run src/features/onboarding/avatar-builder.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/onboarding/avatar-option-group.tsx src/features/onboarding/avatar-builder.tsx src/features/onboarding/avatar-builder.test.tsx src/messages
git commit -m "feat(avatar): rebuild the avatar builder around DiceBear Micah options" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ"
```

---

### Task 5: Wire the form and the onboarding page (typecheck goes green)

**Files:**
- Modify: `src/features/onboarding/profile-form.tsx`, `src/features/onboarding/profile-form.test.tsx`, `src/features/onboarding/onboarding-view.tsx`, `src/app/(picker)/onboarding/page.tsx`

**Interfaces:**
- Consumes: `AvatarBuilder` (Task 4), the `avatar` JSON form field contract (Task 2), `defaultAvatarFor`.
- Produces: `OnboardingView({ avatar }: { avatar: AvatarConfig })`.

- [ ] **Step 1: Update the failing test**

`src/features/onboarding/profile-form.test.tsx` (replace the file):

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/server/actions/profile", () => ({
  completeOnboardingAction: vi.fn(async () => ({ ok: true, data: undefined })),
  updateProfileAction: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import { defaultAvatarFor } from "@/lib/avatar/generate";
import { avatarConfigSchema } from "@/lib/avatar/schema";
import type { ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

const initial: ProfileFields = {
  fullName: "",
  nickname: "",
  avatar: defaultAvatarFor("user-1"),
  cefrLevel: null,
  learningGoal: null,
};

describe("ProfileForm", () => {
  it("renders required name fields and the avatar builder", () => {
    render(<ProfileForm mode="onboarding" initial={initial} />);
    // Field's required-asterisk suffix (" *") makes the label's accessible
    // text "fullNameLabel *" rather than an exact match — use a regex like
    // the rest of the codebase does for required Field labels (see
    // add-knowledge-view.test.tsx).
    expect(screen.getByLabelText(/fullNameLabel/)).toBeRequired();
    expect(screen.getByLabelText(/nicknameLabel/)).toBeRequired();
    expect(screen.getByRole("group", { name: "groups.hair" })).toBeInTheDocument();
  });

  it("posts the avatar as one JSON field that follows the builder", async () => {
    const { container } = render(<ProfileForm mode="onboarding" initial={initial} />);
    const field = () => container.querySelector<HTMLInputElement>('input[name="avatar"]')!;

    expect(JSON.parse(field().value)).toEqual(initial.avatar);

    await userEvent.click(screen.getByRole("button", { name: /surpriseMe/ }));
    const next = JSON.parse(field().value);
    expect(avatarConfigSchema.safeParse(next).success).toBe(true);
    expect(next).not.toEqual(initial.avatar);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/onboarding/profile-form.test.tsx`
Expected: FAIL (form still posts five separate hidden inputs).

- [ ] **Step 3: Implement**

`src/features/onboarding/profile-form.tsx`: replace the five hidden inputs

```tsx
      <input type="hidden" name="character" value={avatar.character} />
      <input type="hidden" name="skinColor" value={avatar.skinColor} />
      <input type="hidden" name="hairColor" value={avatar.hairColor} />
      <input type="hidden" name="shirtColor" value={avatar.shirtColor} />
      <input type="hidden" name="backgroundColor" value={avatar.backgroundColor} />
```

with

```tsx
      <input type="hidden" name="avatar" value={JSON.stringify(avatar)} />
```

`src/features/onboarding/onboarding-view.tsx` (replace the file):

```tsx
import { getTranslations } from "next-intl/server";

import type { AvatarConfig, ProfileFields } from "@/types";

import { ProfileForm } from "./profile-form";

export async function OnboardingView({ avatar }: { avatar: AvatarConfig }) {
  const t = await getTranslations("onboarding");

  const initial: ProfileFields = {
    fullName: "",
    nickname: "",
    avatar,
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

`src/app/(picker)/onboarding/page.tsx`: add `import { defaultAvatarFor } from "@/lib/avatar/generate";` (with the other `@/lib` import) and change the last line to

```tsx
  return <OnboardingView avatar={user.avatar ?? defaultAvatarFor(user.id)} />;
```

(`user.avatar` is already resolved by `getCurrentUser` when a profile row exists; the fallback covers the no-profile-row case.)

- [ ] **Step 4: Run the full gates**

Run: `npm run typecheck ; npm run lint ; npm test`
Expected: typecheck **green** (first time since Task 1), lint clean (no new warnings vs. the Task 1 baseline), all tests pass except any failures already present in the Task 1 baseline. If typecheck reports leftovers, they are references to removed exports: run `grep -rn "DEFAULT_AVATAR\|AVATAR_CHARACTERS\|AvatarCharacterId\|avatar-characters\|\-\-avatar-" src` and fix each.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding src/app
git commit -m "feat(avatar): post the avatar as one JSON field and seed onboarding from the user id" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ"
```

---

### Task 6: Verification — build, persistence and responsive checks

**Files:** none committed. Temporary files (`public/_m.html`, scratch scripts) must be deleted before finishing.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: succeeds. This proves the bundler resolves `@dicebear/styles/micah.json` (package `exports` map) and `@dicebear/core` in both server and client bundles. If the build fails on the JSON import, report the exact error and stop — do not work around it by copying or inlining the JSON without asking.

- [ ] **Step 2: Start the app and load the builder**

Run `npm run dev` in the background. Follow the memory notes `responsive-testing-iframe-harness` (window resize is broken; use a same-origin iframe file in `public/`, set the `NEXT_LOCALE` cookie explicitly; `nl` is the longer-string case) and sign in with the no-email path: `npm run auth:link -- omarcode.business@gmail.com` (prints a magic link; open it in the Chrome tool). The admin is already onboarded, so exercise the builder at **`/profile` → edit** (same `ProfileForm`).

Check and record:
- The preview updates instantly for every row; Surprise me always yields a sensible avatar; None tiles remove accessories.
- Keyboard: Tab reaches each row once; Arrow keys move within a row and select; the focus ring is visible; hover and selected states are clearly distinct.
- With the OS "reduce motion" setting on (or via emulation), tiles do not lift or scale.
- Hair thumbnails and the 24px avatar in the knowledge list (`meta-row`) read clearly at `xs`. If the face reads too small at 24px, add DiceBear `scale`/`translateY` to `toMicahOptions` (update its test), and re-check; otherwise leave it.
- Mobile (iframe ≈ 375px) and desktop (≈ 1280px), in `nl` and `en`: no horizontal overflow, options wrap cleanly (skin/background swatches fit one row on mobile), targets ≥ 36px, the sticky preview at the top of the form on mobile does not collide with any sticky app header in `/profile` (if it does, change `top-0` in `avatar-builder.tsx` to the header's offset), and the credit line wraps without clipping.

- [ ] **Step 3: Persistence and reconstruction, end to end**

In `/profile` edit: change hair, colors and add glasses; save; reload the page. Expect the same avatar. Then read the stored value (read-only) with a scratch script in the scratchpad directory:

```ts
// dotenv -e .env.local -- tsx <scratch>/read-avatar.ts
import postgres from "postgres";
const sql = postgres(process.env.SUPABASE_DB_DIRECT_URL!, { prepare: false });
const rows = await sql`select id, avatar from profiles where id is not null`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
```

Expected: `avatar` is a small structured object with `provider:"dicebear"`, `style:"micah"`, `version:1`, `seed`, the chosen ids, and no SVG/data URI. Confirm it round-trips: reload `/profile` and the group settings member list; the avatar is identical.

Legacy handling: before your first save, the admin row still holds the old character-shaped avatar. Confirm the app rendered a deterministic default for it (no crash) on the first visit to `/profile`; reloading gives the same default.

Note for the user: this step changes the admin profile's avatar in the shared dev database (the only effect).

- [ ] **Step 4: `/onboarding` layout (ask first)**

`/onboarding` redirects onboarded users. To see it you need a not-yet-onboarded session, which means creating a throwaway auth user in the shared dev Supabase (`npm run auth:link -- <throwaway> --type invite`) and deleting it afterwards through the Admin API. **Ask the user before doing this.** If they decline, state in the report that `/onboarding` was verified indirectly (same `ProfileForm`/`AvatarBuilder`, wrapped by the `(picker)` card `max-w-xl p-8`, whose content width at 375px is ≈ 261px, enough for four 56px tiles and six 36px swatches per row).

- [ ] **Step 5: Cleanup and final gates**

Delete any harness file (`public/_m.html`), scratch scripts and stop the dev server. Then run `npm run typecheck ; npm run lint ; npm test` once more, plus `git status` (expect a clean tree apart from any deliberate tuning commit). If Step 2 led to a tuning change, commit it:

```bash
git add -A
git commit -m "fix(avatar): tune Micah crop/positioning after visual check" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QgJVbrKiveJR7LBRq44xMZ"
```

---

### Task 7: Finish the branch

- [ ] **Step 1:** Invoke `superpowers:finishing-a-development-branch` and follow it (the previous phases merged via PR).
- [ ] **Step 2:** In the final summary to the user, list: files changed, "no database migration", "run `npm install` after merge (two new dependencies)", "the admin avatar shows a deterministic default until re-saved" (or note that it was re-saved during verification), the CC BY credit location, and any deviations from this plan.
- [ ] **Step 3:** After merge, update project memory (`avatar system = DiceBear Micah, config shape, resolveAvatar contract`) and the MEMORY.md index.

---

## Notes and known risks

- **HTML weight:** each `<Avatar>` inlines a ~6–8 KB data URI. Long lists (the library rows show the adder's avatar on every item) repeat identical strings; HTTP compression collapses repeats, but if the library page payload becomes noticeably heavy, the follow-up is a shared `<svg><symbol>` sprite or a cached static route: out of scope here.
- **Legacy avatars** are not migrated to a "closest" Micah look (out of scope); they fall back to the deterministic default.
- **Facial features** (eyes, brows, mouth, nose, ears, clothes) are seed-driven; "Surprise me" rerolls the seed too.

## Self-review against the spec

- Data model, palettes-as-ids, no SQL migration → Task 1 (types/schema), Global Constraints.
- Write path (JSON `avatar` field, zod, tolerant parse) → Task 2. Read path (`resolveAvatar` in `session`, `memberships`, `knowledge`, `profile-service`; `DEFAULT_AVATAR` removed) → Tasks 1–2.
- Rendering (`toMicahOptions` pins + probability 0, memoized `Style`, `<img>` data URI, no `dangerouslySetInnerHTML`, `xl` size, unchanged `Avatar` API) → Tasks 1, 3.
- `randomAvatar` / Surprise me → Tasks 1, 4.
- Builder UI (thumbnail rows, color circles, radiogroups, None tiles, states, `motion-safe`, responsive, i18n EN+NL, CC BY credit) → Task 4; sticky/responsive verification → Task 6.
- Cleanup of old characters/`DEFAULT_AVATAR`/CSS vars → Tasks 3, 5 (grep in Task 5 Step 4; there are no `--avatar-*` variables in `globals.css`, confirmed).
- Testing list (resolve cases, random validity ×200, options pinning, palette collisions, data URI, round trip, updated schema/Avatar/builder/form/profile-service tests) → Tasks 1–5. Gates and manual persistence/responsive checks → Tasks 5–6.
- Owner manual steps and admin-avatar note → Task 7.
