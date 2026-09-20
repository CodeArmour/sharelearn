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
