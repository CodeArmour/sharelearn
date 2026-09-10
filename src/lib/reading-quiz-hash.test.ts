// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readingBodyHash } from "./reading-quiz-hash";

describe("readingBodyHash", () => {
  it("is stable for the same input", () => {
    expect(readingBodyHash("De kat zit op de mat.")).toBe(readingBodyHash("De kat zit op de mat."));
  });

  it("ignores whitespace-run and case differences", () => {
    expect(readingBodyHash("De kat  zit\n op de mat.")).toBe(
      readingBodyHash("de KAT zit op de mat."),
    );
  });

  it("changes when the wording changes", () => {
    expect(readingBodyHash("De kat zit op de mat.")).not.toBe(
      readingBodyHash("De hond zit op de mat."),
    );
  });

  it("returns 16 lowercase hex characters", () => {
    expect(readingBodyHash("iets willekeurigs")).toMatch(/^[0-9a-f]{16}$/);
  });
});
