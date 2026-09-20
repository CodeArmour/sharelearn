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
