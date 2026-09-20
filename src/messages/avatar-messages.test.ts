// @vitest-environment node
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
} from "@/types";
import en from "./en.json";
import nl from "./nl.json";

type Tree = { [key: string]: string | Tree };

/** Flattens a nested message object into `{ "a.b.c": "value" }`. */
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const locales = {
  en: flatten((en as unknown as { onboarding: { avatar: Tree } }).onboarding.avatar),
  nl: flatten((nl as unknown as { onboarding: { avatar: Tree } }).onboarding.avatar),
};

const idGroups: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["hair", HAIR_STYLES],
  ["glasses", GLASSES_VARIANTS],
  ["earrings", EARRINGS_VARIANTS],
  ["facialHair", FACIAL_HAIR_VARIANTS],
  ["colors", SKIN_COLORS],
  ["colors", HAIR_COLORS],
  ["colors", SHIRT_COLORS],
  ["colors", BACKGROUND_COLORS],
];

describe("onboarding.avatar messages", () => {
  it("has identical key paths in en.json and nl.json", () => {
    expect(Object.keys(locales.nl).sort()).toEqual(Object.keys(locales.en).sort());
  });

  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}: translates every avatar option id with a non-empty string`, () => {
      const missing: string[] = [];
      for (const [group, ids] of idGroups) {
        for (const id of ids) {
          const value = messages[`${group}.${id}`];
          if (typeof value !== "string" || value.trim() === "") missing.push(`${group}.${id}`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});
