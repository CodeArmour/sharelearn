// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountdown } from "./use-countdown";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useCountdown", () => {
  it("reports the full duration at the start", () => {
    const { result } = renderHook(() => useCountdown(1_000_000, 5_000));
    expect(result.current.remainingMs).toBe(5_000);
    expect(result.current.expired).toBe(false);
  });

  it("counts down each second and expires at zero", () => {
    const { result } = renderHook(() => useCountdown(1_000_000, 5_000));

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.remainingMs).toBe(2_000);
    expect(result.current.expired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  it("is already expired when the start + duration is in the past", () => {
    const { result } = renderHook(() => useCountdown(0, 1_000));
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  it("never goes negative", () => {
    const { result } = renderHook(() => useCountdown(1_000_000, 2_000));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.remainingMs).toBe(0);
  });
});
