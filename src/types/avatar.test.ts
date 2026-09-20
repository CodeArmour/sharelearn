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
