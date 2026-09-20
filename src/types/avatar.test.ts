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
