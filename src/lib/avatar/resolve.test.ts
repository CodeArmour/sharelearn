import { describe, expect, it } from "vitest";

import { defaultAvatarFor } from "./generate";
import { resolveAvatar } from "./resolve";

const valid = defaultAvatarFor("someone-else");

describe("resolveAvatar", () => {
  it("returns a valid stored config unchanged", () => {
    expect(resolveAvatar(valid, "u1")).toEqual(valid);
  });

  it("keeps optional accessories", () => {
    const withAccessories = { ...valid, glasses: "round", facialHair: "beard" };
    expect(resolveAvatar(withAccessories, "u1")).toEqual(withAccessories);
  });

  it("survives a JSON round trip", () => {
    expect(resolveAvatar(JSON.parse(JSON.stringify(valid)), "u1")).toEqual(valid);
  });

  it("strips unknown keys", () => {
    expect(resolveAvatar({ ...valid, extra: 1 }, "u1")).toEqual(valid);
  });

  it("falls back to the deterministic default for null and undefined", () => {
    expect(resolveAvatar(null, "u1")).toEqual(defaultAvatarFor("u1"));
    expect(resolveAvatar(undefined, "u1")).toEqual(defaultAvatarFor("u1"));
  });

  it("falls back for the legacy 10-character shape", () => {
    const legacy = {
      character: "girl-1",
      skinColor: "tan",
      hairColor: "black",
      shirtColor: "teal",
      backgroundColor: "cream",
    };
    expect(resolveAvatar(legacy, "u1")).toEqual(defaultAvatarFor("u1"));
  });

  it("falls back for an unknown version and for garbage", () => {
    expect(resolveAvatar({ ...valid, version: 2 }, "u1")).toEqual(defaultAvatarFor("u1"));
    for (const junk of ["nope", 42, [], {}]) {
      expect(resolveAvatar(junk, "u1")).toEqual(defaultAvatarFor("u1"));
    }
  });
});
