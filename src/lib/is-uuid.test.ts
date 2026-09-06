import { describe, expect, it } from "vitest";

import { isUuid } from "./is-uuid";

describe("isUuid", () => {
  it("accepts a canonical v4 uuid", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejects pre-Phase-2 mock ids", () => {
    expect(isUuid("kn_gezellig")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isUuid("")).toBe(false);
  });

  it("rejects a uuid with surrounding whitespace or extra segments", () => {
    expect(isUuid(" 3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301-extra")).toBe(false);
  });

  it("rejects a non-hex character in the pattern", () => {
    expect(isUuid("gf2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
  });
});
