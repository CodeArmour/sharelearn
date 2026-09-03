// @vitest-environment node
import { describe, expect, it } from "vitest";

import { deriveAccent, deriveInitials } from "./identity";

describe("deriveInitials", () => {
  it("uses dotted / delimited local parts", () => {
    expect(deriveInitials("sofie.vidal@example.com")).toBe("SV");
    expect(deriveInitials("omar@example.com")).toBe("OM");
    expect(deriveInitials("a@example.com")).toBe("A");
  });
});

describe("deriveAccent", () => {
  it("is stable and within the allowed set", () => {
    const a = deriveAccent("user-123");
    expect(a).toBe(deriveAccent("user-123"));
    expect(["vocabulary", "grammar", "reading", "file"]).toContain(a);
  });
});
