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
