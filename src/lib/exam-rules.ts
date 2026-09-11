/**
 * Fixed rules for the exam mode: how long each exam runs, and the pass mark.
 * Kept out of the components so the timer, the results screen, and any future
 * per-level tuning read one source.
 */

/** A run at or above this percentage is a pass. */
export const EXAM_PASS_THRESHOLD = 55;

/**
 * Whole-exam duration in milliseconds for a setup length. Length only ever
 * comes from the exam's 10 / 20 / All control (`0` means "all"), so the
 * ternary covers every real case; anything unexpected gets the longest budget.
 */
export function examDurationMs(length: number): number {
  const minutes = length === 10 ? 30 : length === 20 ? 60 : 90;
  return minutes * 60_000;
}
