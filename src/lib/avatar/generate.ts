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
