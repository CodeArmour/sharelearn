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
