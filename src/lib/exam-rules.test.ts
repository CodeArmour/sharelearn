// @vitest-environment node
import { describe, expect, it } from "vitest";

import { EXAM_PASS_THRESHOLD, examDurationMs } from "./exam-rules";

describe("examDurationMs", () => {
  it("maps the three exam lengths to their durations", () => {
    expect(examDurationMs(10)).toBe(30 * 60_000);
    expect(examDurationMs(20)).toBe(60 * 60_000);
    expect(examDurationMs(0)).toBe(90 * 60_000); // "all"
  });

  it("falls back to 90 minutes for any other value", () => {
    expect(examDurationMs(7)).toBe(90 * 60_000);
    expect(examDurationMs(999)).toBe(90 * 60_000);
  });
});

describe("EXAM_PASS_THRESHOLD", () => {
  it("is 55", () => {
    expect(EXAM_PASS_THRESHOLD).toBe(55);
  });
});
