import { describe, expect, it } from "vitest";

import {
  BACKGROUND_COLORS,
  HAIR_COLORS,
  SHIRT_COLORS,
  SKIN_COLORS,
} from "@/types";

import {
  BACKGROUND_COLOR_HEX,
  HAIR_COLOR_HEX,
  SHIRT_COLOR_HEX,
  SKIN_COLOR_HEX,
} from "./avatar-palette";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

describe("avatar palette hex maps", () => {
  it("covers every skin/hair/shirt/background id with a valid hex value", () => {
    for (const id of SKIN_COLORS) expect(SKIN_COLOR_HEX[id]).toMatch(HEX_RE);
    for (const id of HAIR_COLORS) expect(HAIR_COLOR_HEX[id]).toMatch(HEX_RE);
    for (const id of SHIRT_COLORS) expect(SHIRT_COLOR_HEX[id]).toMatch(HEX_RE);
    for (const id of BACKGROUND_COLORS) expect(BACKGROUND_COLOR_HEX[id]).toMatch(HEX_RE);
  });

  it("never reuses a hex value across palettes (Micah colors carry notEqualTo rules)", () => {
    const all = [SKIN_COLOR_HEX, HAIR_COLOR_HEX, SHIRT_COLOR_HEX, BACKGROUND_COLOR_HEX].flatMap(
      (map) => Object.values(map).map((hex) => hex.toLowerCase()),
    );
    expect(new Set(all).size).toBe(all.length);
  });
});
