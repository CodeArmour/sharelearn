"use client";

import { useEffect, useState } from "react";

/**
 * Counts down to `startedAtMs + durationMs`, re-rendering about once a second.
 * Anchored to the wall clock (not to accumulated ticks) so a throttled
 * background tab can't slow the exam. The interval clears itself at expiry.
 */
export function useCountdown(
  startedAtMs: number,
  durationMs: number,
): { remainingMs: number; expired: boolean } {
  const read = () => Math.max(0, startedAtMs + durationMs - Date.now());
  const [remainingMs, setRemainingMs] = useState(read);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemainingMs(read());
    if (startedAtMs + durationMs - Date.now() <= 0) return;

    const id = setInterval(() => {
      const next = Math.max(0, startedAtMs + durationMs - Date.now());
      setRemainingMs(next);
      if (next === 0) clearInterval(id);
    }, 1_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAtMs, durationMs]);

  return { remainingMs, expired: remainingMs === 0 };
}
