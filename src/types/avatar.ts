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
