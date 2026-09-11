# Exam as a Real Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flexible exam with one strict "real exam" — Mixed only, scoped by CEFR level, length 10/20/all with a guaranteed 1/3 reading / 1/3 grammar / 1/3 vocabulary split, an overall countdown that locks and submits at zero, and a one-question-per-page paper with a question navigator (jump, answered/unanswered colours, pinnable questions).

**Architecture:** A pure `composeExam` helper does the balanced selection from per-type question pools; `generateExamQuestions` stops delegating to the practice generator and builds those pools from level-filtered items using per-type builders it now shares with `generatePracticeQuestions`. The exam UI is rebuilt around a step index (`ExamSession`), a wall-clock `useCountdown` hook feeding an `ExamTimer`, and an `ExamNavigator`; the shared `SetupForm` gains a `variant="exam"` that hides the mode buttons and locks scope to level. No database change.

**Tech Stack:** Next.js (vendored — see `AGENTS.md`), TypeScript, React, Vitest + @testing-library/react, next-intl, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-11-exam-real-mode-design.md`

## Global Constraints

- **Gates (all must pass before every commit):** `npm run typecheck`, `npm run lint`, `npm test`. Run `npx next typegen` before `typecheck` if `PageProps` errors appear (Task 9 changes the exam page's props).
- **Do NOT run** `npm run format` / prettier — red repo-wide; never `--write` files you touch.
- **Every new i18n key goes in BOTH** `src/messages/en.json` and `src/messages/nl.json`.
- **Server / Node tests** start with `// @vitest-environment node` as line 1. Component/hook tests run under jsdom (the default) and mock `next-intl` with the namespace stub `useTranslations: (ns) => (key) => ns ? \`${ns}.${key}\` : key`.
- **No live DB, no live AI.** `practice-service` tests mock `@/server/repositories/knowledge` and `@/server/services/session-service` (see the existing `practice-service.test.ts`).
- **No database migration.** `study_runs` already models exam runs (`kind:'exam'`, `mode:null`, `scope:'level'`, `level`, counts, timestamps).
- **`generatePracticeQuestions` output must not change.** Its existing tests in `practice-service.test.ts` are the guard — they must stay green untouched after the Task 4 refactor.
- **Commit message trailer** (end every commit body with exactly these two lines):
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0128NHFrqnzu7AisJ7EhUsfB
  ```
- Branch: `worktree-exam-real-mode` (already checked out; spec already committed here). Branched off `main`.
- "All" length is the value `0` throughout the codebase (`LENGTHS` in `setup-form.tsx`).

---

### Task 1: `exam-rules.ts` — duration + pass threshold

**Files:**
- Create: `src/lib/exam-rules.ts`
- Test: `src/lib/exam-rules.test.ts`
- Modify: `src/features/exam/exam-results.tsx` (use the shared constant)

**Interfaces:**
- Produces:
  - `EXAM_PASS_THRESHOLD: number` (= `55`)
  - `examDurationMs(length: number): number` — whole-exam duration in ms; `10 → 30 min`, `20 → 60 min`, anything else (incl. `0` = "all") → `90 min`

- [ ] **Step 1: Write the failing test**

Create `src/lib/exam-rules.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/exam-rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/exam-rules.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/exam-rules.test.ts`
Expected: PASS (3)

- [ ] **Step 5: Point `exam-results.tsx` at the constant**

In `src/features/exam/exam-results.tsx`:

- Add the import alongside the other `@/` imports:
  ```ts
  import { EXAM_PASS_THRESHOLD } from "@/lib/exam-rules";
  ```
- Delete the line `const PASS_THRESHOLD = 55;`.
- Change `const passed = percent >= PASS_THRESHOLD;` to `const passed = percent >= EXAM_PASS_THRESHOLD;`.

- [ ] **Step 6: Run the gates & commit**

Run: `npm run typecheck` && `npm run lint` && `npx vitest run src/lib/exam-rules.test.ts` → Expected: PASS

```bash
git add src/lib/exam-rules.ts src/lib/exam-rules.test.ts src/features/exam/exam-results.tsx
git commit
```

Subject: `feat(exam): add exam-rules (duration by length, pass threshold)`
(end with the standard trailer)

---

### Task 2: `useCountdown` hook

**Files:**
- Create: `src/lib/use-countdown.ts`
- Test: `src/lib/use-countdown.test.ts`

**Interfaces:**
- Produces: `useCountdown(startedAtMs: number, durationMs: number): { remainingMs: number; expired: boolean }` — wall-clock anchored, re-renders ~1×/s, `remainingMs` never negative, `expired` once `remainingMs === 0`, interval self-clears at expiry.

- [ ] **Step 1: Write the failing test**

Create `src/lib/use-countdown.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/use-countdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/use-countdown.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/use-countdown.test.ts`
Expected: PASS (4)

- [ ] **Step 5: Run the gates & commit**

Run: `npm run typecheck` && `npm run lint` → Expected: PASS

```bash
git add src/lib/use-countdown.ts src/lib/use-countdown.test.ts
git commit
```

Subject: `feat(exam): add useCountdown wall-clock hook`
(end with the standard trailer)

---

### Task 3: `composeExam` — balanced selection helper

**Files:**
- Create: `src/server/services/exam-composition.ts`
- Test: `src/server/services/exam-composition.test.ts`

**Interfaces:**
- Consumes: `PracticeQuestion` from `@/types`
- Produces:
  - `interface ExamPools { reading: PracticeQuestion[]; grammar: PracticeQuestion[]; vocabulary: PracticeQuestion[] }`
  - `composeExam(pools: ExamPools, length: number): PracticeQuestion[]` — pools are assumed already ordered by the caller; this only counts and slices. `length` 10/20 → thirds with remainder priority reading→grammar; a pool short of its target hands its deficit to the pool with the most slack (ties broken reading→grammar→vocabulary). `length === 0` ("all") → `3 × min(pool sizes)`, `min` of each. The concatenation is **not** re-sorted here (the caller does that).

- [ ] **Step 1: Write the failing test**

Create `src/server/services/exam-composition.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PracticeQuestion } from "@/types";

import { composeExam, type ExamPools } from "./exam-composition";

function pool(type: PracticeQuestion["knowledgeType"], n: number): PracticeQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${type}_${i}`,
    knowledgeId: `k_${type}_${i}`,
    knowledgeType: type,
    instructionKey: "meaningOf",
    prompt: `${type} ${i}`,
    options: ["a", "b"],
    correctIndex: 0,
  }));
}

const byType = (qs: PracticeQuestion[]) => ({
  reading: qs.filter((q) => q.knowledgeType === "reading").length,
  grammar: qs.filter((q) => q.knowledgeType === "grammar").length,
  vocabulary: qs.filter((q) => q.knowledgeType === "vocabulary").length,
});

describe("composeExam", () => {
  it("splits 10 as 4 reading / 3 grammar / 3 vocab", () => {
    const pools: ExamPools = {
      reading: pool("reading", 20),
      grammar: pool("grammar", 20),
      vocabulary: pool("vocabulary", 20),
    };
    const out = composeExam(pools, 10);
    expect(out).toHaveLength(10);
    expect(byType(out)).toEqual({ reading: 4, grammar: 3, vocabulary: 3 });
  });

  it("splits 20 as 7 / 7 / 6", () => {
    const pools: ExamPools = {
      reading: pool("reading", 20),
      grammar: pool("grammar", 20),
      vocabulary: pool("vocabulary", 20),
    };
    expect(byType(composeExam(pools, 20))).toEqual({ reading: 7, grammar: 7, vocabulary: 6 });
  });

  it("takes the first N of each pool (pools are pre-ordered)", () => {
    const pools: ExamPools = {
      reading: pool("reading", 20),
      grammar: pool("grammar", 20),
      vocabulary: pool("vocabulary", 20),
    };
    const out = composeExam(pools, 10);
    expect(out.filter((q) => q.knowledgeType === "reading").map((q) => q.id)).toEqual([
      "reading_0", "reading_1", "reading_2", "reading_3",
    ]);
  });

  it("redistributes an empty pool's share to the others, keeping the total", () => {
    const pools: ExamPools = {
      reading: pool("reading", 10),
      grammar: [],
      vocabulary: pool("vocabulary", 10),
    };
    const out = composeExam(pools, 10);
    expect(out).toHaveLength(10);
    const t = byType(out);
    expect(t.grammar).toBe(0);
    expect(t.reading + t.vocabulary).toBe(10);
  });

  it("runs short when the pools together can't fill the length", () => {
    const pools: ExamPools = {
      reading: pool("reading", 2),
      grammar: pool("grammar", 2),
      vocabulary: pool("vocabulary", 2),
    };
    expect(composeExam(pools, 20)).toHaveLength(6);
  });

  it("'all' (length 0) is 3 x the smallest pool", () => {
    const pools: ExamPools = {
      reading: pool("reading", 4),
      grammar: pool("grammar", 9),
      vocabulary: pool("vocabulary", 12),
    };
    const out = composeExam(pools, 0);
    expect(out).toHaveLength(12);
    expect(byType(out)).toEqual({ reading: 4, grammar: 4, vocabulary: 4 });
  });

  it("'all' with an empty pool yields nothing", () => {
    const pools: ExamPools = {
      reading: [],
      grammar: pool("grammar", 5),
      vocabulary: pool("vocabulary", 5),
    };
    expect(composeExam(pools, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/exam-composition.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/server/services/exam-composition.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/services/exam-composition.test.ts`
Expected: PASS (7)

- [ ] **Step 5: Run the gates & commit**

Run: `npm run typecheck` && `npm run lint` → Expected: PASS

```bash
git add src/server/services/exam-composition.ts src/server/services/exam-composition.test.ts
git commit
```

Subject: `feat(exam): add composeExam balanced-selection helper`
(end with the standard trailer)

---

### Task 4: `practice-service` — per-type builders + real `generateExamQuestions`

**Files:**
- Modify: `src/server/services/practice-service.ts`
- Test: `src/server/services/practice-service.test.ts` (extend)

**Interfaces:**
- Consumes: `composeExam`, `ExamPools` (Task 3)
- Produces: `generateExamQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]>` — one `listKnowledgeItems` read; filters to `setup.level`; builds the three pools with the shared builders; `composeExam`; final hash-sort. Returns `[]` when `setup.level` is missing. Ignores `setup.mode` (always mixed). `generatePracticeQuestions` behaviour is unchanged.

- [ ] **Step 1: Write the failing tests**

Read the top of `src/server/services/practice-service.test.ts` for its existing mock setup and the `vocab(...)` / `reading(...)` / `sampleQuiz` factories (added in the reading-questions branch). Add a `grammar(...)` factory near them if one isn't already present:

```ts
function grammar(id: string, title: string, groupId: string) {
  return {
    id,
    groupId,
    type: "grammar" as const,
    level: "A2" as const,
    tags: [],
    source: "manual" as const,
    addedBy: user,
    updatedBy: null,
    createdAt: "2026-09-04T08:00:00.000Z",
    updatedAt: "2026-09-04T08:00:00.000Z",
    title,
    summary: `${title} summary`,
    explanation: `${title} explanation`,
    examples: [{ nl: `${title} nl`, en: `${title} en` }],
  };
}
```

Add a new `describe` block (adjust the `reading(...)` / `vocab(...)` / `grammar(...)` calls to whatever those factories' signatures are in the file):

```ts
import { generateExamQuestions } from "./practice-service";

describe("generateExamQuestions — real exam", () => {
  it("only draws items at the chosen level", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      vocab("v1", "aap", "monkey", "g1", "B1"),
      vocab("v2", "boom", "tree", "g1", "A1"),
    ] as never);

    const qs = await generateExamQuestions({
      mode: "mixed", scope: "level", level: "B1", length: 0,
    });

    for (const q of qs) expect(q.knowledgeId).toBe("v1");
  });

  it("returns [] when no level is set", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      vocab("v1", "aap", "monkey", "g1", "B1"),
    ] as never);
    expect(
      await generateExamQuestions({ mode: "mixed", scope: "level", length: 10 }),
    ).toEqual([]);
  });

  it("balances a length-10 exam into 4 reading / 3 grammar / 3 vocab when the level is rich enough", async () => {
    const items: unknown[] = [];
    for (let i = 0; i < 8; i += 1) items.push(vocab(`v${i}`, `term${i}`, `mean${i}`, "g1", "B1"));
    for (let i = 0; i < 8; i += 1) items.push(grammar(`g${i}`, `Rule ${i}`, "g1"));
    for (let i = 0; i < 3; i += 1) {
      items.push(reading(`r${i}`, `Text ${i}`, "g1", quizWith2(`r${i}`), "B1"));
    }
    vi.mocked(listKnowledgeItems).mockResolvedValue(items as never);

    const qs = await generateExamQuestions({
      mode: "mixed", scope: "level", level: "B1", length: 10,
    });

    expect(qs).toHaveLength(10);
    const t = {
      reading: qs.filter((q) => q.knowledgeType === "reading").length,
      grammar: qs.filter((q) => q.knowledgeType === "grammar").length,
      vocabulary: qs.filter((q) => q.knowledgeType === "vocabulary").length,
    };
    expect(t).toEqual({ reading: 4, grammar: 3, vocabulary: 3 });
  });

  it("ignores setup.mode — always mixed", async () => {
    const items: unknown[] = [];
    for (let i = 0; i < 6; i += 1) items.push(vocab(`v${i}`, `t${i}`, `m${i}`, "g1", "B1"));
    for (let i = 0; i < 6; i += 1) items.push(grammar(`g${i}`, `R${i}`, "g1"));
    vi.mocked(listKnowledgeItems).mockResolvedValue(items as never);

    const qs = await generateExamQuestions({
      mode: "vocabulary", scope: "level", level: "B1", length: 10,
    });
    expect(qs.some((q) => q.knowledgeType === "grammar")).toBe(true);
  });

  it("reads the library once", async () => {
    vi.mocked(listKnowledgeItems).mockResolvedValue([
      vocab("v1", "aap", "monkey", "g1", "B1"),
    ] as never);
    await generateExamQuestions({ mode: "mixed", scope: "level", level: "B1", length: 10 });
    expect(vi.mocked(listKnowledgeItems)).toHaveBeenCalledTimes(1);
  });
});
```

Add a `quizWith2(readingId)` helper near the fixtures if `sampleQuiz` in the file isn't reusable with a distinct id — it must return a `ReadingQuiz` whose two questions have ids `q1`, `q2` so the built `PracticeQuestion` ids are unique per reading:

```ts
import type { ReadingQuiz } from "@/types";
function quizWith2(readingId: string): ReadingQuiz {
  return {
    promptVersion: "v1",
    generatedAt: "2026-09-09T00:00:00.000Z",
    sourceHash: `hash_${readingId}`,
    questions: [
      { id: "q1", kind: "mcq", prompt: `${readingId} q1`, options: ["A", "B", "C", "D"], correctIndex: 0 },
      { id: "q2", kind: "mcq", prompt: `${readingId} q2`, options: ["A", "B", "C", "D"], correctIndex: 1 },
    ],
  };
}
```

> **Implementer note:** the exact factory signatures (`vocab`, `reading`) already
> exist in this file — match them. If `vocab` doesn't take a `level` argument,
> add an optional 5th param `level = "A2"` that sets the row's `level`, used by
> the level-filter test above; don't change existing call sites.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/services/practice-service.test.ts`
Expected: FAIL — `generateExamQuestions` still equals `generatePracticeQuestions`, so `mode: "vocabulary"` drops grammar, the level-10 split is a plain slice, etc.

- [ ] **Step 3: Extract the per-type builders**

In `src/server/services/practice-service.ts`, add these three functions above `generatePracticeQuestions` (lift the bodies verbatim from the current inline `forEach` blocks — do not change their logic, ids, guards, or push order):

```ts
function buildVocabQuestions(
  items: VocabularyItem[],
  allTerms: string[],
  allMeanings: string[],
): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((v, idx) => {
    if (idx % 2 === 1) {
      const { options, correctIndex } = buildOptions(v.term, allTerms, `t:${v.id}`);
      if (options.length >= 2) {
        out.push({
          id: `q_${v.id}_t`,
          knowledgeId: v.id,
          knowledgeType: "vocabulary",
          instructionKey: "sayInDutch",
          prompt: v.meaning,
          options,
          correctIndex,
        });
      }
    } else {
      const { options, correctIndex } = buildOptions(v.meaning, allMeanings, `m:${v.id}`);
      if (options.length >= 2) {
        out.push({
          id: `q_${v.id}_m`,
          knowledgeId: v.id,
          knowledgeType: "vocabulary",
          instructionKey: "meaningOf",
          prompt: v.term,
          options,
          correctIndex,
        });
      }
    }
  });
  return out;
}

function buildGrammarQuestions(items: GrammarItem[], allTitles: string[]): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((g) => {
    const { options, correctIndex } = buildOptions(g.title, allTitles, `g:${g.id}`);
    if (options.length >= 2) {
      out.push({
        id: `q_${g.id}`,
        knowledgeId: g.id,
        knowledgeType: "grammar",
        instructionKey: "whichRule",
        prompt: g.examples[0]?.nl ?? g.summary,
        options,
        correctIndex,
      });
    }
  });
  return out;
}

function buildReadingQuestions(items: ReadingItem[]): PracticeQuestion[] {
  const out: PracticeQuestion[] = [];
  items.forEach((r) => {
    const quiz = r.readingQuiz;
    if (!quiz) return;
    for (const qq of quiz.questions) {
      out.push({
        id: `q_${r.id}_${qq.id}`,
        knowledgeId: r.id,
        knowledgeType: "reading",
        instructionKey: qq.kind === "true-false" ? "trueOrFalse" : "readComprehension",
        prompt: qq.prompt,
        options: qq.options,
        correctIndex: qq.correctIndex,
        passage: { id: r.id, title: r.title, body: r.body },
      });
    }
  });
  return out;
}
```

- [ ] **Step 4: Rewire `generatePracticeQuestions` to the builders (behaviour identical)**

Replace the three inline `if (wantVocab) { … }` / `if (wantGrammar) { … }` / `if (wantReading) { … }` blocks and the `const questions: PracticeQuestion[] = [];` line with:

```ts
  const inScopeVocab = inScope.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const inScopeGrammar = inScope.filter((i): i is GrammarItem => i.type === "grammar");
  const inScopeReading = inScope.filter((i): i is ReadingItem => i.type === "reading");

  const questions: PracticeQuestion[] = [
    ...(wantVocab ? buildVocabQuestions(inScopeVocab, allTerms, allMeanings) : []),
    ...(wantGrammar ? buildGrammarQuestions(inScopeGrammar, allTitles) : []),
    ...(wantReading ? buildReadingQuestions(inScopeReading) : []),
  ];
```

The `sortKey` + `sort` + `slice` lines below stay exactly as they are.

- [ ] **Step 5: Write the real `generateExamQuestions`**

Add the import at the top:

```ts
import { composeExam, type ExamPools } from "./exam-composition";
```

Replace the whole `generateExamQuestions` function with:

```ts
export async function generateExamQuestions(setup: PracticeSetup): Promise<PracticeQuestion[]> {
  const groupId = await requireActiveGroupId();
  const groupItems: KnowledgeItem[] = await listKnowledgeItems(groupId, {});
  if (!setup.level) return [];

  const levelItems = groupItems.filter((i) => i.level === setup.level);
  const vocabAll = groupItems.filter((i): i is VocabularyItem => i.type === "vocabulary");
  const allTerms = vocabAll.map((v) => v.term);
  const allMeanings = vocabAll.map((v) => v.meaning);
  const allTitles = groupItems
    .filter((i): i is GrammarItem => i.type === "grammar")
    .map((g) => g.title);

  const sortKey = (q: PracticeQuestion) =>
    q.passage ? hashString(q.passage.id) : hashString(q.id);
  const ordered = (list: PracticeQuestion[]) => [...list].sort((a, b) => sortKey(a) - sortKey(b));

  const pools: ExamPools = {
    reading: ordered(
      buildReadingQuestions(levelItems.filter((i): i is ReadingItem => i.type === "reading")),
    ),
    grammar: ordered(
      buildGrammarQuestions(
        levelItems.filter((i): i is GrammarItem => i.type === "grammar"),
        allTitles,
      ),
    ),
    vocabulary: ordered(
      buildVocabQuestions(
        levelItems.filter((i): i is VocabularyItem => i.type === "vocabulary"),
        allTerms,
        allMeanings,
      ),
    ),
  };

  return composeExam(pools, setup.length).sort((a, b) => sortKey(a) - sortKey(b));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/server/services/practice-service.test.ts`
Expected: PASS — the pre-existing `generatePracticeQuestions` tests **and** the new exam tests.

- [ ] **Step 7: Full gates & commit**

Run: `npm run typecheck` && `npm run lint` && `npm test` → Expected: PASS

```bash
git add src/server/services/practice-service.ts src/server/services/practice-service.test.ts
git commit
```

Subject: `feat(exam): real generateExamQuestions — level-scoped, thirds-balanced`
(end with the standard trailer)

---

### Task 5: `SetupForm` — `variant="exam"`

**Files:**
- Modify: `src/components/shared/setup-form.tsx`
- Test: `src/components/shared/setup-form.test.tsx` (extend)

**Interfaces:**
- Produces: `SetupForm` accepts `variant?: "practice" | "exam"` (default `"practice"`). `"exam"`: no mode button group; the scope `<select>` offers only **By level**, disabled when `levels` is empty; the level `<select>` is always shown; length group unchanged. `"practice"` (or unset): render is byte-for-byte as today.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/shared/setup-form.test.tsx`:

```ts
describe("SetupForm exam variant", () => {
  const examSetup: PracticeSetup = { mode: "mixed", scope: "level", level: "B1", length: 20 };

  it("hides the mode buttons", () => {
    render(
      <SetupForm
        setup={examSetup}
        levels={["A1", "B1"]}
        count={10}
        startLabel="Start exam"
        variant="exam"
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "practice.setup.mode.mixed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "practice.setup.mode.reading" })).not.toBeInTheDocument();
  });

  it("offers only the by-level scope option", () => {
    render(
      <SetupForm
        setup={examSetup}
        levels={["A1", "B1"]}
        count={10}
        startLabel="Start exam"
        variant="exam"
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    const scope = screen.getByLabelText("practice.setup.scopeLabel") as HTMLSelectElement;
    const values = Array.from(scope.options).map((o) => o.value);
    expect(values).toEqual(["level"]);
  });

  it("still shows the length group", () => {
    render(
      <SetupForm
        setup={examSetup}
        levels={["A1", "B1"]}
        count={10}
        startLabel="Start exam"
        variant="exam"
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "practice.setup.lengthLabel" })).toBeInTheDocument();
  });
});
```

> **Implementer note:** confirm the scope `<Select>` has an accessible name of
> `practice.setup.scopeLabel` (it's wrapped in `<Field label={t("scopeLabel")}
> htmlFor="setup-scope">`). If `getByLabelText` doesn't resolve, select it by
> `screen.getByRole("combobox")` / its `id="setup-scope"` instead — the
> assertion (option values === `["level"]`) is the point.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/shared/setup-form.test.tsx`
Expected: FAIL — `variant` isn't a prop; the mode buttons render; the scope select has all options.

- [ ] **Step 3: Implement `variant`**

In `src/components/shared/setup-form.tsx`:

- Add to the prop list and destructure (default it):
  ```tsx
    /** "exam" hides the mode buttons and locks scope to level. */
    variant = "practice",
  ```
  and in the type: `variant?: "practice" | "exam";`
- Near the top of the component body: `const isExam = variant === "exam";`
- The mode button group is currently rendered as `{isCustom ? null : ( <div …mode group… /> )}`. Change the guard to `{isExam || isCustom ? null : ( … )}`.
- The scope `<Select>` currently lists its `<option>`s conditionally. Wrap them:
  ```tsx
  <Select
    id="setup-scope"
    value={setup.scope}
    disabled={isExam && levels.length === 0}
    onChange={(e) => {
      const scope = e.target.value as PracticeScope;
      onChange(scope === "level" ? { scope, level: setup.level ?? levels[0] } : { scope });
    }}
  >
    {isExam ? (
      <option value="level">{t("scope.level")}</option>
    ) : (
      <>
        {filterSummary ? <option value="custom">{t("scope.custom")}</option> : null}
        <option value="all">{t("scope.all")}</option>
        <option value="today">{t("scope.today")}</option>
        <option value="review">{t("scope.review")}</option>
        {levels.length > 0 ? <option value="level">{t("scope.level")}</option> : null}
      </>
    )}
  </Select>
  ```
- The level `<Field>` is currently `{setup.scope === "level" ? ( … ) : null}`. Change to `{setup.scope === "level" || isExam ? ( … ) : null}`.

Practice callers pass no `variant`, so every branch above falls to its existing behaviour.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/shared/setup-form.test.tsx`
Expected: PASS — the 3 new tests and the 2 pre-existing "reading mode" tests.

- [ ] **Step 5: Full gates & commit**

Run: `npm run typecheck` && `npm run lint` && `npm test` → Expected: PASS

```bash
git add src/components/shared/setup-form.tsx src/components/shared/setup-form.test.tsx
git commit
```

Subject: `feat(exam): SetupForm variant="exam" (no mode, level scope only)`
(end with the standard trailer)

---

### Task 6: i18n — exam session + about copy

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/nl.json`

**Interfaces:**
- Produces: new keys under `exam.session` (flat + a nested `timeUp` and `handInConfirm`), and a rewritten `exam.setup.about.points` array — in **both** locale files, same shape.

- [ ] **Step 1: Add the keys to `en.json`**

Under `exam.session`, add (keep the existing `answered` / `unanswered` / `handIn` / `questionNumber`):

```json
"timeLeft": "Time left",
"pin": "Flag for review",
"unpin": "Remove flag",
"prev": "Previous",
"next": "Next",
"navigatorTitle": "Questions",
"navigatorAnswered": "Answered",
"navigatorUnanswered": "Not answered",
"navigatorFlagged": "Flagged",
"timeUp": {
  "title": "Time is up",
  "body": "Your exam has been handed in.",
  "viewResults": "See results"
},
"handInConfirm": {
  "title": "Hand in now?",
  "body": "{unanswered} unanswered, {flagged} flagged. You can't change anything after handing in.",
  "confirm": "Hand in",
  "cancel": "Keep working"
}
```

Replace `exam.setup.about.points` with:

```json
"points": [
  "Mixed questions — one third reading, grammar, and vocabulary",
  "Timed: 30 min for 10 questions, 1 h for 20, 1½ h for all",
  "One question per page; flag any to revisit; no feedback until you hand in"
]
```

- [ ] **Step 2: Add the same keys to `nl.json`**

Under `exam.session`:

```json
"timeLeft": "Resterende tijd",
"pin": "Markeer om terug te komen",
"unpin": "Verwijder markering",
"prev": "Vorige",
"next": "Volgende",
"navigatorTitle": "Vragen",
"navigatorAnswered": "Beantwoord",
"navigatorUnanswered": "Niet beantwoord",
"navigatorFlagged": "Gemarkeerd",
"timeUp": {
  "title": "De tijd is om",
  "body": "Je examen is ingeleverd.",
  "viewResults": "Bekijk resultaten"
},
"handInConfirm": {
  "title": "Nu inleveren?",
  "body": "{unanswered} onbeantwoord, {flagged} gemarkeerd. Na inleveren kun je niets meer wijzigen.",
  "confirm": "Inleveren",
  "cancel": "Doorgaan"
}
```

Replace `exam.setup.about.points`:

```json
"points": [
  "Gemengde vragen — een derde lezen, grammatica en woordenschat",
  "Met tijdslimiet: 30 min voor 10 vragen, 1 uur voor 20, 1½ uur voor alle",
  "Eén vraag per pagina; markeer vragen om terug te komen; geen feedback tot je inlevert"
]
```

- [ ] **Step 3: Verify JSON + gates**

Run: `node -e "require('./src/messages/en.json'); require('./src/messages/nl.json'); console.log('json ok')"`
Run: `npm run typecheck` && `npm run lint` && `npm test` → Expected: PASS (nothing consumes the keys yet; this confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
git add src/messages/en.json src/messages/nl.json
git commit
```

Subject: `feat(exam): i18n for timer, navigator, pin, time's-up, hand-in confirm`
(end with the standard trailer)

---

### Task 7: `ExamTimer` + `ExamNavigator` components

**Files:**
- Create: `src/features/exam/exam-timer.tsx`
- Create: `src/features/exam/exam-navigator.tsx`
- Test: `src/features/exam/exam-navigator.test.tsx`

**Interfaces:**
- Consumes: `exam.session.*` i18n keys (Task 6)
- Produces:
  - `ExamTimer({ remainingMs: number })` — renders `mm:ss` (`Math.ceil` of seconds), `aria-label` = `exam.session.timeLeft`, a warning class when `remainingMs < 5 * 60_000`.
  - `ExamNavigator({ count: number; current: number; answered: boolean[]; pinned: boolean[]; onJump: (index: number) => void })` — a numbered grid; each cell styled by answered / not, ringed when `current`, flag-badged when `pinned`; `onJump(i)` on click; a legend row.

- [ ] **Step 1: Write the failing test**

Create `src/features/exam/exam-navigator.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

import { ExamNavigator } from "./exam-navigator";

describe("ExamNavigator", () => {
  const base = {
    count: 4,
    current: 1,
    answered: [true, false, false, true],
    pinned: [false, false, true, false],
    onJump: vi.fn(),
  };

  it("renders one button per question", () => {
    render(<ExamNavigator {...base} onJump={vi.fn()} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
  });

  it("marks the current question with aria-current", () => {
    render(<ExamNavigator {...base} onJump={vi.fn()} />);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute("aria-current");
  });

  it("jumps on click", () => {
    const onJump = vi.fn();
    render(<ExamNavigator {...base} onJump={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("shows a flag on pinned questions only", () => {
    render(<ExamNavigator {...base} onJump={vi.fn()} />);
    // question 3 is pinned — its button contains the flag's accessible marker
    const pinnedBtn = screen.getByRole("button", { name: "3" });
    expect(pinnedBtn.querySelector("svg")).not.toBeNull();
    const plainBtn = screen.getByRole("button", { name: "1" });
    expect(plainBtn.querySelector("svg")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/exam/exam-navigator.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `ExamTimer`**

Create `src/features/exam/exam-timer.tsx`:

```tsx
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

const WARN_MS = 5 * 60_000;

/** The exam countdown, shown as mm:ss. Turns to a warning colour in the last 5 minutes. */
export function ExamTimer({ remainingMs }: { remainingMs: number }) {
  const t = useTranslations("exam.session");
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");

  return (
    <span
      aria-label={t("timeLeft")}
      className={cn(
        "font-display text-h3 tabular-nums",
        remainingMs < WARN_MS ? "text-error-strong" : "text-fg",
      )}
    >
      {mm}:{ss}
    </span>
  );
}
```

- [ ] **Step 4: Write `ExamNavigator`**

Create `src/features/exam/exam-navigator.tsx`:

```tsx
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils/cn";

export function ExamNavigator({
  count,
  current,
  answered,
  pinned,
  onJump,
}: {
  count: number;
  current: number;
  answered: boolean[];
  pinned: boolean[];
  onJump: (index: number) => void;
}) {
  const t = useTranslations("exam.session");

  return (
    <nav aria-label={t("navigatorTitle")} className="flex flex-col gap-3">
      <span className="text-label font-medium text-fg-secondary">{t("navigatorTitle")}</span>
      <ol className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              aria-current={i === current ? "step" : undefined}
              onClick={() => onJump(i)}
              className={cn(
                "relative grid h-9 w-full place-items-center rounded-md text-body-sm font-medium transition-colors",
                answered[i]
                  ? "bg-primary text-on-primary"
                  : "bg-surface-sunken text-fg-muted hover:text-fg",
                i === current && "ring-2 ring-border-focus",
              )}
            >
              {i + 1}
              {pinned[i] ? (
                <Flag
                  className="absolute -right-1 -top-1 size-3 text-warning-strong"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
          {t("navigatorAnswered")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-surface-sunken" aria-hidden />
          {t("navigatorUnanswered")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag className="size-2.5 text-warning-strong" aria-hidden />
          {t("navigatorFlagged")}
        </span>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/exam/exam-navigator.test.tsx`
Expected: PASS (4)

- [ ] **Step 6: Full gates & commit**

Run: `npm run typecheck` && `npm run lint` && `npm test` → Expected: PASS

```bash
git add src/features/exam/exam-timer.tsx src/features/exam/exam-navigator.tsx src/features/exam/exam-navigator.test.tsx
git commit
```

Subject: `feat(exam): add ExamTimer and ExamNavigator`
(end with the standard trailer)

---

### Task 8: `ExamSession` — one question per page

**Files:**
- Modify (full rewrite): `src/features/exam/exam-session.tsx`
- Test: `src/features/exam/exam-session.test.tsx` (new)

**Interfaces:**
- Consumes: `examDurationMs` (Task 1), `useCountdown` (Task 2), `ExamTimer` + `ExamNavigator` (Task 7), `exam.session.*` i18n (Task 6), `PassagePanel` / `OptionButton` from `@/components/shared`
- Produces: `ExamSession({ questions: PracticeQuestion[]; onSubmit: (answers: (number | null)[]) => void; startedAtMs: number; length: number })`. One question per page; Prev/Next; per-question pin; right-side (desktop) / disclosure (mobile) navigator; countdown via `ExamTimer`; a hand-in confirm when anything is unanswered or flagged; a time's-up panel that locks input and auto-submits after 10 s; a `submittedRef` guard so `onSubmit` fires exactly once.

- [ ] **Step 1: Write the failing test**

Create `src/features/exam/exam-session.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, vals?: Record<string, unknown>) =>
    vals ? `${ns}.${key}:${JSON.stringify(vals)}` : ns ? `${ns}.${key}` : key,
}));

import type { PracticeQuestion } from "@/types";

import { ExamSession } from "./exam-session";

const q = (id: string, prompt: string): PracticeQuestion => ({
  id,
  knowledgeId: id,
  knowledgeType: "vocabulary",
  instructionKey: "meaningOf",
  prompt,
  options: ["a", "b", "c"],
  correctIndex: 0,
});

const START = 1_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

function renderSession(over: Partial<Parameters<typeof ExamSession>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <ExamSession
      questions={[q("q1", "First"), q("q2", "Second"), q("q3", "Third")]}
      onSubmit={onSubmit}
      startedAtMs={START}
      length={10}
      {...over}
    />,
  );
  return onSubmit;
}

describe("ExamSession", () => {
  it("shows one question at a time and moves with Next / Previous", () => {
    renderSession();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "exam.session.prev" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.next" }));
    expect(screen.getByText("Second")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.next" }));
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "exam.session.next" })).toBeDisabled();
  });

  it("jumps via the navigator and records answers", () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "a" })); // answer q1
    fireEvent.click(screen.getByRole("button", { name: "3" })); // navigator → q3
    expect(screen.getByText("Third")).toBeInTheDocument();
    // navigator cell 1 now shows answered (aria-current is on 3)
    expect(screen.getByRole("button", { name: "1" })).toHaveClass("bg-primary");
  });

  it("pins the current question", () => {
    renderSession();
    const pin = screen.getByRole("button", { name: "exam.session.pin" });
    fireEvent.click(pin);
    expect(screen.getByRole("button", { name: "exam.session.unpin" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("asks to confirm hand-in when questions are unanswered", () => {
    const onSubmit = renderSession();
    fireEvent.click(screen.getByRole("button", { name: "exam.session.handIn" }));
    expect(screen.getByText(/exam\.session\.handInConfirm\.title/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.handInConfirm.cancel" }));
    expect(screen.queryByText(/exam\.session\.handInConfirm\.title/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "exam.session.handIn" }));
    fireEvent.click(screen.getByRole("button", { name: "exam.session.handInConfirm.confirm" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([null, null, null]);
  });

  it("hands in straight away when everything is answered and nothing is flagged", () => {
    const onSubmit = renderSession({ questions: [q("q1", "Only")] });
    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "exam.session.handIn" }));
    expect(onSubmit).toHaveBeenCalledWith([0]);
  });

  it("locks and auto-submits when time runs out", () => {
    const onSubmit = renderSession({ length: 10 }); // 30 min budget
    act(() => {
      vi.setSystemTime(START + 30 * 60_000 + 1000);
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/exam\.session\.timeUp\.title/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "a" })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000); // auto-submit timeout
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("never submits twice", () => {
    const onSubmit = renderSession({ length: 10 });
    act(() => {
      vi.setSystemTime(START + 30 * 60_000 + 1000);
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole("button", { name: "exam.session.timeUp.viewResults" }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/exam/exam-session.test.tsx`
Expected: FAIL — the current `ExamSession` renders every question at once, has no timer / navigator / pin / confirm, and its props don't include `startedAtMs` / `length`.

- [ ] **Step 3: Rewrite `ExamSession`**

Replace the whole of `src/features/exam/exam-session.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Flag } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PracticeQuestion } from "@/types";
import { examDurationMs } from "@/lib/exam-rules";
import { useCountdown } from "@/lib/use-countdown";
import { useFocusOnChange } from "@/lib/use-focus-on-change";
import { Button } from "@/components/ui";
import { OptionButton, type OptionState, PassagePanel } from "@/components/shared";
import { cn } from "@/lib/utils/cn";

import { ExamNavigator } from "./exam-navigator";
import { ExamTimer } from "./exam-timer";

const AUTOSUBMIT_MS = 10_000;

/**
 * The exam paper: one question per page, a countdown, a question navigator, and
 * per-question flags. No feedback. Handing in — or the timer reaching zero —
 * ends the run exactly once.
 */
export function ExamSession({
  questions,
  onSubmit,
  startedAtMs,
  length,
}: {
  questions: PracticeQuestion[];
  onSubmit: (answers: (number | null)[]) => void;
  startedAtMs: number;
  length: number;
}) {
  const t = useTranslations("exam.session");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [pinned, setPinned] = useState<boolean[]>(() => questions.map(() => false));
  const [confirming, setConfirming] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const submittedRef = useRef(false);

  const { remainingMs, expired } = useCountdown(startedAtMs, examDurationMs(length));

  const regionRef = useRef<HTMLDivElement>(null);
  useFocusOnChange(regionRef, index);

  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answers);
  };

  useEffect(() => {
    if (!expired || submittedRef.current) return;
    const id = setTimeout(submit, AUTOSUBMIT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const q = questions[index];
  const answeredCount = answers.filter((a) => a !== null).length;
  const flaggedCount = pinned.filter(Boolean).length;

  const pick = (opt: number) => setAnswers((prev) => prev.map((a, i) => (i === index ? opt : a)));
  const togglePin = () => setPinned((prev) => prev.map((p, i) => (i === index ? !p : p)));

  const handIn = () => {
    if (answeredCount < questions.length || flaggedCount > 0) setConfirming(true);
    else submit();
  };

  const navigator = (
    <ExamNavigator
      count={questions.length}
      current={index}
      answered={answers.map((a) => a !== null)}
      pinned={pinned}
      onJump={(i) => {
        setConfirming(false);
        setNavOpen(false);
        setIndex(i);
      }}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-[42rem]">
        <div className="flex items-center justify-between">
          <span className="text-label text-fg-muted">
            {t("questionNumber", { number: index + 1 })} / {questions.length}
          </span>
          <ExamTimer remainingMs={remainingMs} />
        </div>

        <button
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-body-sm text-fg-secondary lg:hidden"
        >
          {t("navigatorTitle")}
          <span className="text-fg-muted">
            {t("answered", { answered: answeredCount, total: questions.length })}
          </span>
        </button>
        {navOpen ? <div className="lg:hidden">{navigator}</div> : null}

        <div ref={regionRef} tabIndex={-1} className="flex flex-col gap-4 outline-none">
          {expired ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-border p-8 text-center">
              <p className="font-display text-h3 text-fg">{t("timeUp.title")}</p>
              <p className="text-body-sm text-fg-secondary">{t("timeUp.body")}</p>
              <Button type="button" size="md" onClick={submit}>
                {t("timeUp.viewResults")}
              </Button>
            </div>
          ) : confirming ? (
            <div className="flex flex-col gap-3 rounded-card border border-border p-6">
              <p className="font-display text-h3 text-fg">{t("handInConfirm.title")}</p>
              <p className="text-body-sm text-fg-secondary">
                {t("handInConfirm.body", {
                  unanswered: questions.length - answeredCount,
                  flagged: flaggedCount,
                })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button type="button" size="md" onClick={submit}>
                  {t("handInConfirm.confirm")}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  onClick={() => setConfirming(false)}
                >
                  {t("handInConfirm.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {q.passage ? <PassagePanel passage={q.passage} /> : null}
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-h3 text-fg">{q.prompt}</p>
                <button
                  type="button"
                  aria-pressed={pinned[index]}
                  onClick={togglePin}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-body-sm transition-colors",
                    pinned[index]
                      ? "border-warning-strong text-warning-strong"
                      : "border-border text-fg-muted hover:text-fg",
                  )}
                >
                  <Flag className="size-4" aria-hidden />
                  {pinned[index] ? t("unpin") : t("pin")}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <OptionButton
                    key={opt}
                    label={opt}
                    state={(answers[index] === oi ? "selected" : "idle") as OptionState}
                    onClick={() => pick(oi)}
                  />
                ))}
              </div>
              <div className="flex justify-between gap-3">
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ArrowLeft className="size-[18px]" strokeWidth={2} aria-hidden />
                  {t("prev")}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="outline"
                  disabled={index === questions.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  {t("next")}
                  <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="hidden lg:block lg:w-56 lg:shrink-0">
        {navigator}
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-body-sm text-fg-muted">
            {t("answered", { answered: answeredCount, total: questions.length })}
          </span>
          <Button type="button" size="md" onClick={handIn} disabled={expired}>
            {t("handIn")}
          </Button>
        </div>
      </aside>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 flex items-center gap-3 border-t border-border bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <Button type="button" size="md" onClick={handIn} disabled={expired}>
          {t("handIn")}
        </Button>
        <span className="text-body-sm text-fg-muted">
          {t("answered", { answered: answeredCount, total: questions.length })}
        </span>
      </div>
    </div>
  );
}
```

> **Implementer note:** the test mocks `useTranslations` so `t("handIn")` →
> `"exam.session.handIn"` and `t("answered", {…})` →
> `"exam.session.answered:{…}"`. The **mobile** hand-in button and the **desktop**
> aside hand-in button therefore have the *same* accessible name
> `"exam.session.handIn"` — `getByRole("button", { name: "exam.session.handIn" })`
> will throw "multiple elements". In the test, scope those queries: render is
> jsdom with no layout, so both are in the DOM. Use
> `screen.getAllByRole("button", { name: "exam.session.handIn" })[0]` for the
> clicks, or give the two buttons distinct wrappers and query within. Adjust the
> test's hand-in clicks accordingly; keep the assertions.

- [ ] **Step 4: Make the test green**

Reconcile the test's selectors with the component per the note above (prefer `getAllBy…[0]` for the duplicated hand-in button). Run:

Run: `npx vitest run src/features/exam/exam-session.test.tsx`
Expected: PASS (8)

- [ ] **Step 5: Full gates & commit**

Run: `npm run typecheck` && `npm run lint` && `npm test` → Expected: PASS

```bash
git add src/features/exam/exam-session.tsx src/features/exam/exam-session.test.tsx
git commit
```

Subject: `feat(exam): one-question-per-page session with timer, navigator, flags`
(end with the standard trailer)

---

### Task 9: `ExamView` + exam page — wire it together

**Files:**
- Modify: `src/features/exam/exam-view.tsx`
- Modify: `src/app/(app)/exam/page.tsx`
- Test: `src/features/exam/exam-view.test.tsx` (new)

**Interfaces:**
- Consumes: `SetupForm` `variant` (Task 5), `ExamSession` new props (Task 8)
- Produces: `ExamView({ levels: string[] })` — exam-only setup (initial `{ mode: "mixed", scope: "level", level: levels[0], length: 20 }`, `variant="exam"`), passes `startedAtMs` + `length` into `ExamSession`, and while the session phase is active attaches a `beforeunload` guard. The exam page renders `<ExamView levels={facets.levels} />` and nothing else.

- [ ] **Step 1: Write the failing test**

Create `src/features/exam/exam-view.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));
vi.mock("@/server/actions/practice", () => ({
  generateExamQuestionsAction: vi.fn(),
}));
vi.mock("@/server/actions/personal", () => ({
  recordStudyRunAction: vi.fn().mockResolvedValue({ ok: true }),
}));
// Stub the heavy children so this test is about ExamView's wiring.
vi.mock("@/components/shared", async (orig) => ({
  ...(await orig<typeof import("@/components/shared")>()),
  SetupForm: (props: Record<string, unknown>) => (
    <button type="button" data-variant={props.variant as string} onClick={props.onStart as () => void}>
      start-stub
    </button>
  ),
}));
vi.mock("./exam-session", () => ({
  ExamSession: (props: Record<string, unknown>) => (
    <div data-testid="exam-session" data-length={String(props.length)} data-started={String(props.startedAtMs)} />
  ),
}));
vi.mock("./exam-results", () => ({ ExamResults: () => <div data-testid="exam-results" /> }));

import { generateExamQuestionsAction } from "@/server/actions/practice";

import { ExamView } from "./exam-view";

const addSpy = vi.spyOn(window, "addEventListener");
const removeSpy = vi.spyOn(window, "removeEventListener");

beforeEach(() => {
  addSpy.mockClear();
  removeSpy.mockClear();
  vi.mocked(generateExamQuestionsAction).mockResolvedValue({
    ok: true,
    data: [
      { id: "q1", knowledgeId: "q1", knowledgeType: "vocabulary", instructionKey: "meaningOf", prompt: "p", options: ["a", "b"], correctIndex: 0 },
    ],
  } as never);
});
afterEach(() => vi.clearAllMocks());

describe("ExamView", () => {
  it("gives SetupForm the exam variant", async () => {
    render(<ExamView levels={["A1", "B1"]} />);
    expect(await screen.findByText("start-stub")).toHaveAttribute("data-variant", "exam");
  });

  it("enters the session with a timer length and attaches a beforeunload guard", async () => {
    render(<ExamView levels={["A1", "B1"]} />);
    await waitFor(() => expect(generateExamQuestionsAction).toHaveBeenCalled());

    fireEvent.click(screen.getByText("start-stub"));

    const session = await screen.findByTestId("exam-session");
    expect(session).toHaveAttribute("data-length", "20");
    expect(session.getAttribute("data-started")).not.toBe("null");
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/exam/exam-view.test.tsx`
Expected: FAIL — `ExamView` still takes `initialScope` etc., doesn't pass `variant="exam"`, doesn't pass `length` / `startedAtMs` to `ExamSession`, and has no `beforeunload` guard.

- [ ] **Step 3: Rewrite `ExamView`**

In `src/features/exam/exam-view.tsx`:

- **Props:** replace the whole props object with `{ levels }: { levels: string[] }`. Remove `initialScope`, `initialFilter`, `filterSummary` and their types.
- **Imports:** drop `useReviewMarks` and `PracticeFilter` / `PracticeScope` from the type import if now unused. Keep `useEffect`, `useRef`, `useState`.
- **Initial setup:**
  ```tsx
  const [setup, setSetup] = useState<PracticeSetup>({
    mode: "mixed",
    scope: "level",
    level: levels[0],
    length: 20,
  });
  ```
- **`resolved`:** delete it and the `reviewMarks` state; call `generateExamQuestionsAction(setup)` directly in the preview effect (dependency array `[setup]`).
- **Phase type:** the `session` and `results` variants gain `startedAtMs: number`:
  ```tsx
  type Phase =
    | { name: "setup" }
    | { name: "session"; questions: PracticeQuestion[]; startedAtMs: number }
    | { name: "results"; questions: PracticeQuestion[]; answers: (number | null)[]; startedAtMs: number };
  ```
- **Start handler:** capture the start time once:
  ```tsx
  onStart={() => {
    if (preview.length > 0) {
      const startedAtMs = Date.now();
      startedAtRef.current = new Date(startedAtMs).toISOString();
      setPhase({ name: "session", questions: preview, startedAtMs });
    }
  }}
  ```
- **`SetupForm`:** add `variant="exam"`; remove the `filterSummary={filterSummary}` prop.
- **`ExamSession`:** pass the new props:
  ```tsx
  <ExamSession
    questions={phase.questions}
    startedAtMs={phase.startedAtMs}
    length={setup.length}
    onSubmit={(answers) => {
      saveRun(answers, phase.questions);
      setPhase({ name: "results", questions: phase.questions, answers, startedAtMs: phase.startedAtMs });
    }}
  />
  ```
- **`beforeunload` guard** — add near the other hooks:
  ```tsx
  useEffect(() => {
    if (phase.name !== "session") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase.name]);
  ```
- `onAgain` on `ExamResults` stays as-is (resets `startedAtRef`, back to setup).

- [ ] **Step 4: Simplify the exam page**

Replace `src/app/(app)/exam/page.tsx` with:

```tsx
import { getLibraryFacets } from "@/server/services/knowledge-service";
import { titleMetadata } from "@/lib/page-metadata";
import { ExamView } from "@/features/exam";

export const generateMetadata = titleMetadata((t) => t("nav.exam"));

export default async function ExamPage() {
  const facets = await getLibraryFacets();
  return <ExamView levels={facets.levels} />;
}
```

(Drops `searchParams` / `PageProps<"/exam">`, `parsePracticeFilter`,
`buildFilterSummary`, and the `PracticeScope` import.)

- [ ] **Step 5: Regenerate route types, then the tests**

Run: `npx next typegen`
Run: `npx vitest run src/features/exam/exam-view.test.tsx`
Expected: PASS (2)

- [ ] **Step 6: Full gates & commit**

Run: `npm run typecheck` && `npm run lint` && `npm test` → Expected: PASS (whole suite)

```bash
git add src/features/exam/exam-view.tsx "src/app/(app)/exam/page.tsx" src/features/exam/exam-view.test.tsx
git commit
```

Subject: `feat(exam): exam-only setup, timer wiring, leave guard; simplify /exam`
(end with the standard trailer)

---

## Post-implementation (manual smoke — owner or executor with a running app)

- `/exam` shows the narrowed setup: level picker + length, no mode buttons, no other scopes.
- Start a length-10 exam at a level with a rich library → 10 questions, roughly 4 reading / 3 grammar / 3 vocab, one per page, a 30:00 countdown, the navigator on the right.
- Answer a few, flag one, jump around via the navigator (colours + flag update), Next/Prev bounded.
- Hand in with blanks/flags → confirm panel; confirm → results with the pass/fail pill.
- Reload mid-exam → browser "Leave site?" prompt.
- Let the clock hit 0 (or set a short `examDurationMs` locally) → time's-up panel, then results.
- Run a practice session → its setup and flow are unchanged.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
| --- | --- |
| §4.1 `SetupForm` `variant="exam"` | Task 5 |
| §4.2 `ExamView` exam-only setup + `/exam` page trim | Task 9 |
| §5.1 `composeExam` (thirds, remainder priority, shortfall, "all" = 3×min) | Task 3 |
| §5.2 `generateExamQuestions` rewrite + shared per-type builders | Task 4 |
| §5.3 preview count still `preview.length` | Task 9 (unchanged effect) |
| §6.1 `exam-rules.ts` — `examDurationMs`, `EXAM_PASS_THRESHOLD` | Task 1 |
| §6.2 `useCountdown` | Task 2 |
| §6.3 `ExamTimer` (mm:ss, warn < 5 min, aria-label) | Task 7 |
| §7.1 `ExamSession` state (index, answers, pinned, submitted guard, timeUp) | Task 8 |
| §7.2 two-column desktop / disclosure mobile layout | Task 8 |
| §7.3 per-question page (passage, prompt, pin, options, prev/next) | Task 8 |
| §7.4 `ExamNavigator` (states, jump, legend) | Task 7 |
| §7.5 hand-in + confirm on unanswered/flagged | Task 8 |
| §7.6 time's-up panel + 10 s auto-submit | Task 8 |
| §8 `beforeunload` guard; no in-app guard; no restart control | Task 9 |
| §9 results unchanged; `EXAM_PASS_THRESHOLD` import | Task 1 (step 5) |
| §10 i18n keys + about copy, both locales | Task 6 |
| §11 edge cases | Task 3 tests (shortfall / "all" / empty), Task 8 tests (double-submit guard, expiry), Task 4 tests (missing level) |
| §12 test strategy (per file) | each task ships the spec's named test file |
| §13 file-change summary | matches the Files blocks across Tasks 1–9 |
| §14 gates | Global Constraints |

No gaps. (`src/features/exam/index.ts` in §13 needs no change — the new components are imported by relative path, not the barrel.)

**2. Placeholder scan**

No "TBD" / "handle errors" / "similar to Task N". Two spots lean on the
implementer reading the existing file: Task 4 step 1 (match the existing
`vocab` / `reading` factory signatures in `practice-service.test.ts`) and Task 5
step 1 / Task 8 step 3 (accessible-name reconciliation for a mocked `t`). Each
is called out inline with a concrete fallback and the assertion that must
survive.

**3. Type consistency**

- `ExamPools { reading, grammar, vocabulary }` — identical in Task 3 (def) and
  Task 4 (construction).
- `composeExam(pools, length): PracticeQuestion[]` — Task 3 def; Task 4 caller
  passes ordered pools and re-sorts the result (matches the "caller sorts"
  contract in the Task 3 interface + spec §5.1).
- `examDurationMs(length)` — Task 1 def; consumed in Task 8 (`ExamSession`) and
  by `useCountdown` there. `EXAM_PASS_THRESHOLD` — Task 1 def; consumed Task 1
  step 5 (`exam-results.tsx`).
- `useCountdown(startedAtMs, durationMs) → { remainingMs, expired }` — Task 2
  def; Task 8 calls `useCountdown(startedAtMs, examDurationMs(length))`.
- `ExamTimer({ remainingMs })` / `ExamNavigator({ count, current, answered,
  pinned, onJump })` — Task 7 defs; Task 8 renders both with exactly those
  props.
- `ExamSession({ questions, onSubmit, startedAtMs, length })` — Task 8 def;
  Task 9 passes `startedAtMs={phase.startedAtMs}` and `length={setup.length}`.
- `SetupForm` `variant?: "practice" | "exam"` — Task 5 def; Task 9 passes
  `variant="exam"`.
- `ExamView({ levels })` — Task 9 def; the exam page passes `levels={facets.levels}`.

No mismatches found.
