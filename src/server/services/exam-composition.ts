import "server-only";

import type { PracticeQuestion } from "@/types";

export interface ExamPools {
  reading: PracticeQuestion[];
  grammar: PracticeQuestion[];
  vocabulary: PracticeQuestion[];
}

type PoolKey = keyof ExamPools;
/** Priority for the remainder question and for slack tie-breaks. */
const ORDER: PoolKey[] = ["reading", "grammar", "vocabulary"];

/**
 * Pick a balanced exam set from already-ordered per-type pools. `length` is
 * 10, 20, or 0 ("all"). The caller orders the pools and re-sorts the result;
 * this only decides how many of each type to take.
 */
export function composeExam(pools: ExamPools, length: number): PracticeQuestion[] {
  const avail: Record<PoolKey, number> = {
    reading: pools.reading.length,
    grammar: pools.grammar.length,
    vocabulary: pools.vocabulary.length,
  };

  if (length === 0) {
    const n = Math.min(avail.reading, avail.grammar, avail.vocabulary);
    return [
      ...pools.reading.slice(0, n),
      ...pools.grammar.slice(0, n),
      ...pools.vocabulary.slice(0, n),
    ];
  }

  const base = Math.floor(length / 3);
  const rem = length % 3;
  const target: Record<PoolKey, number> = {
    reading: base + (rem >= 1 ? 1 : 0),
    grammar: base + (rem >= 2 ? 1 : 0),
    vocabulary: base,
  };

  // Clamp each target to its pool; pool the shortfall.
  let deficit = 0;
  for (const k of ORDER) {
    if (target[k] > avail[k]) {
      deficit += target[k] - avail[k];
      target[k] = avail[k];
    }
  }
  // Hand the shortfall to whichever pool has the most unused capacity.
  while (deficit > 0) {
    let best: PoolKey | null = null;
    let bestSlack = 0;
    for (const k of ORDER) {
      const slack = avail[k] - target[k];
      if (slack > bestSlack) {
        bestSlack = slack;
        best = k;
      }
    }
    if (!best) break; // no capacity anywhere — the exam just runs short
    target[best] += 1;
    deficit -= 1;
  }

  return [
    ...pools.reading.slice(0, target.reading),
    ...pools.grammar.slice(0, target.grammar),
    ...pools.vocabulary.slice(0, target.vocabulary),
  ];
}
