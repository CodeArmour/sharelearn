import "server-only";

import type { PracticeQuestion } from "@/types";

export interface ExamPools {
  reading: PracticeQuestion[];
  grammar: PracticeQuestion[];
  vocabulary: PracticeQuestion[];
}

type PoolKey = keyof ExamPools;
type Random = () => number;
/** Priority for the remainder question and for slack tie-breaks. */
const ORDER: PoolKey[] = ["reading", "grammar", "vocabulary"];

function shuffle<T>(items: T[], random: Random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function selectRandom<T>(items: T[], count: number, random: Random): T[] {
  return shuffle(items, random).slice(0, count);
}

/** Keep questions from one reading passage together while randomizing the paper. */
function arrangeExam(questions: PracticeQuestion[], random: Random): PracticeQuestion[] {
  const individualQuestions: PracticeQuestion[][] = [];
  const passageQuestions = new Map<string, PracticeQuestion[]>();

  for (const question of questions) {
    if (!question.passage) {
      individualQuestions.push([question]);
      continue;
    }
    const block = passageQuestions.get(question.passage.id) ?? [];
    block.push(question);
    passageQuestions.set(question.passage.id, block);
  }

  return shuffle([...individualQuestions, ...passageQuestions.values()], random).flat();
}

/**
 * Pick and arrange a balanced random exam set. `length` is 10, 20, or 0
 * ("all"). Reading-passage questions remain together, but every new paper
 * samples available questions and arranges its question blocks afresh.
 */
export function composeExam(
  pools: ExamPools,
  length: number,
  random: Random = Math.random,
): PracticeQuestion[] {
  const avail: Record<PoolKey, number> = {
    reading: pools.reading.length,
    grammar: pools.grammar.length,
    vocabulary: pools.vocabulary.length,
  };

  if (length === 0) {
    const n = Math.min(avail.reading, avail.grammar, avail.vocabulary);
    return arrangeExam([
      ...selectRandom(pools.reading, n, random),
      ...selectRandom(pools.grammar, n, random),
      ...selectRandom(pools.vocabulary, n, random),
    ], random);
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

  return arrangeExam([
    ...selectRandom(pools.reading, target.reading, random),
    ...selectRandom(pools.grammar, target.grammar, random),
    ...selectRandom(pools.vocabulary, target.vocabulary, random),
  ], random);
}
