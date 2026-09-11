# Phase B — Exam as a Real Mode

**Date:** 2026-09-11
**Status:** Designed — branch `worktree-exam-real-mode`. No DB migration.
**Scope:** Turn the exam from a flexible variant of practice into a single,
opinionated "real exam": always **Mixed**, always scoped **by CEFR level**,
length **10 / 20 / all**, with the question set **guaranteed 1/3 reading, 1/3
grammar, 1/3 vocabulary**. Add an **overall countdown timer** (10 → 30 min, 20 →
60 min, all → 90 min) that locks the paper and submits when it runs out. Replace
the single-page paper with **one question per page** plus a **right-side
navigator** (jump to any question; cells coloured by answered / unanswered;
questions can be **pinned** for review) and **Next / Previous**. Leaving mid-exam
**abandons the run** (browser-level warning; nothing is persisted). Results are
unchanged: percent, `correct of total`, **pass/fail at 55%**.

**One exam. The old flexible exam (mode selector, any scope, no timer,
single-page paper) is removed, not kept alongside.**

---

## 1. Context

The exam today is `generateExamQuestions === generatePracticeQuestions`
verbatim, driven by the same shared `SetupForm` (mode buttons + scope dropdown +
length) and rendered by `src/features/exam/`:

- `exam-view.tsx` — a 3-phase client machine (`setup → session → results`),
  in-memory. Re-previews the question count via `generateExamQuestionsAction`
  on every setup change; captures a `startedAt` timestamp on Start; records the
  finished run with `buildStudyRunInput({ kind: "exam", ... })`.
- `exam-session.tsx` — every question on one scrollable page, no mid-run
  feedback, a sticky "Hand in" footer with an answered/unanswered counter.
- `exam-results.tsx` — percent, `correct of total`, a **pass/fail pill at a
  hardcoded `PASS_THRESHOLD = 55`**, the `QuestionReviewList`, "New exam" /
  "Back to Today".
- `src/app/(app)/exam/page.tsx` — parses a `?scope=review` param and a Library
  "practice these" custom filter, otherwise defaults scope to `all`.

`study_runs` already models exam runs: `kind: 'exam'`, `mode: null` (a CHECK
enforces `(kind='practice') = (mode IS NOT NULL)`), `scope`, `level`,
`questionCount`, `correctCount`, `startedAt`, `completedAt`. Percent and
pass/fail are derived on read. `scope` already allows `'level'`.

Phase A (merged) gives readings a stored `reading_quiz` (≥5 MCQ / true-false
questions) that `practice-service` reads instead of synthesising.

### What Phase B changes

| Today | After Phase B |
| --- | --- |
| Exam setup = the full practice form (3 modes, 5 scopes, 3 lengths) | Exam setup = **level picker + length (10/20/all)** only; mode is always Mixed |
| `generateExamQuestions` = practice generator; length is a plain slice | Own path: balanced **1/3 reading / 1/3 grammar / 1/3 vocab**, with shortfall redistribution |
| No timer | **Countdown** by length (30 / 60 / 90 min); locks + submits at zero |
| All questions on one scrollable page | **One question per page** + right-side **navigator** + Next/Prev; questions **pinnable** |
| Leaving the page just… leaves | `beforeunload` warning; the run is **abandoned** (nothing persisted) |
| `PASS_THRESHOLD` inline in `exam-results.tsx` | Same 55%, moved to a named shared constant |

## 2. Decisions locked in brainstorming

- **One exam**, strict. No "casual exam" kept alongside.
- **Mixed only.** No mode selector in exam setup.
- **Scope = by level only.** A level must be chosen; no all / today / custom /
  review for exams. A Library "practice these" filter can still start a
  *practice* run, never an exam.
- **Length 10 / 20 / all**, unchanged control.
- **Composition guaranteed 1/3 / 1/3 / 1/3** by question type (counted per
  *question*, reading questions included).
- **Timer by length:** 10 → 30 min, 20 → 60 min, all → 90 min. **At zero:**
  inputs lock, a "time's up" panel shows a *See results* button, and it
  auto-submits after ~10 s if not clicked. The run is graded on whatever was
  answered.
- **One question per page.** Right-side navigator: numbered cells coloured by
  **answered** vs **not answered**, the **current** cell outlined, **pinned**
  cells badged; click a cell to jump. **Next / Previous** move one question.
  A **pin** ("flag for review") toggle per question.
- **Grading:** pass / fail only, threshold **55%** (kept). No numeric or letter
  grade.
- **Leaving mid-exam** (refresh, close, typed URL): a `beforeunload` prompt;
  confirming abandons the run. No resume, no persistence. Returning to `/exam`
  starts fresh at setup.
- **No schema change.** `study_runs` already fits.

## 3. Explicitly NOT in Phase B

- Extracted exam-style question types (order-the-events,
  match-titles-to-paragraphs, 5-gap sentence numbering) — **descoped from the
  MVP**.
- Numeric (Dutch 1–10) or letter (A–F) grades — pass/fail only.
- Resume-after-leaving / any exam-run persistence.
- Storing exam **duration** on `study_runs`.
- Intercepting **in-app** navigation (sidebar links). Only the browser-level
  `beforeunload` guard is in scope; an in-app navigation abandons the run
  without its own prompt (nothing is lost — nothing was persisted). Revisit if
  it proves annoying.

---

## 4. Exam setup — narrowed

### 4.1 `SetupForm` gains `variant`

```ts
// src/components/shared/setup-form.tsx
variant?: "practice" | "exam"; // default "practice"
```

When `variant === "exam"`:

- The **mode** button group is not rendered (the exam is always Mixed).
- The **scope** `<select>` renders only the **By level** option; there is no
  all / today / review / custom. If `levels` is empty the select is disabled
  and Start stays disabled.
- The **level** `<select>` is always shown (not gated on `scope === "level"`).
- The **length** group is unchanged (10 / 20 / All).
- The live count line and the Start button behave as today
  (`disabled={count === 0}`).

Practice keeps `variant` unset → today's behaviour, byte-for-byte.

### 4.2 `ExamView` + exam page

- `ExamView`'s initial `setup` becomes `{ mode: "mixed", scope: "level",
  level: <first level or undefined>, length: 20 }`. It passes
  `variant="exam"` to `SetupForm`.
- `src/app/(app)/exam/page.tsx` drops the `?scope` param handling and the
  `parsePracticeFilter` / `initialFilter` / `filterSummary` branch entirely.
  It renders `<ExamView levels={facets.levels} />` and nothing else.
- `ExamView` no longer needs `initialScope` / `initialFilter` /
  `filterSummary` props; remove them. `useReviewMarks` / `reviewIds` on the
  resolved setup are dropped (exam scope is never `review`).
- The preview `useEffect` still calls `generateExamQuestionsAction(setup)` on
  every setup change to drive the count and the composition preview.

## 5. Question composition — Mixed, balanced into thirds

### 5.1 Pure helper — `src/server/services/exam-composition.ts`

```ts
export interface ExamPools {
  reading: PracticeQuestion[];
  grammar: PracticeQuestion[];
  vocabulary: PracticeQuestion[];
}

/**
 * Pick a balanced exam set from already-built per-type question pools.
 * `length` is 10, 20, or 0 ("all"). Deterministic: each pool is assumed
 * already hash-ordered by the caller; this only counts and slices.
 */
export function composeExam(pools: ExamPools, length: number): PracticeQuestion[];
```

Rules:

- **Fixed lengths (10, 20):**
  - `base = Math.floor(length / 3)`; `rem = length % 3`.
  - Targets: `reading = base`, `grammar = base`, `vocab = base`, then add 1 to
    `reading` if `rem >= 1`, add 1 to `grammar` if `rem >= 2`.
    → length 10 = **4 reading / 3 grammar / 3 vocab**; length 20 = **7 / 7 / 6**.
  - **Shortfall:** if a pool is smaller than its target, take all of it and add
    the deficit to the still-satisfiable pools, preferring the one with the most
    remaining slack, iterating until no deficit can be moved. If the three pools
    together hold fewer than `length`, the exam runs with what exists.
  - Take the first N of each pool (pools are pre-ordered), concatenate.
- **"all" (`length === 0`):** `n = min(reading.length, grammar.length,
  vocabulary.length)`; take the first `n` of each → a balanced `3n`-question
  exam. (If any pool is empty, `n = 0` and the exam can't start — Start is
  disabled, same as "not enough material".)
- Final concatenation is hash-sorted by question `id` (same deterministic sort
  the practice generator already uses) so types are interleaved, not blocked.

### 5.2 `generateExamQuestions` rewrite (`practice-service.ts`)

Stops delegating to `generatePracticeQuestions`. New body:

1. `requireActiveGroupId()` → one `listKnowledgeItems(groupId, {})` read (same
   as practice — never a second query).
2. Filter to `item.level === setup.level` (exam scope is always `level`; if
   `setup.level` is missing, return `[]`).
3. Build the three pools with the **existing per-type logic**, refactored into
   small builders so both generators share them:
   - `buildVocabQuestions(items, pools)` — the term↔meaning alternating MCQ.
   - `buildGrammarQuestions(items, pools)` — the "which rule" MCQ.
   - `buildReadingQuestions(items)` — map each in-scope reading's
     `reading_quiz.questions` to `PracticeQuestion`s (with `passage`), exactly
     as the Phase A practice path does.
   Each builder returns its list already hash-ordered.
4. `composeExam({ reading, grammar, vocabulary }, setup.length)`.

`generatePracticeQuestions` is refactored to call the same three builders for
its own (unbalanced, sliced-to-`length`) path, so the synthesis logic lives in
one place. Its observable output must not change — covered by its existing
tests.

### 5.3 Preview count

`generateExamQuestionsAction` returns the composed set; `ExamView` uses
`preview.length` for the count line and Start-enabled, unchanged.

## 6. Timer

### 6.1 Duration — `src/lib/exam-rules.ts`

```ts
export const EXAM_PASS_THRESHOLD = 55; // moved here from exam-results.tsx

/** Whole-exam duration in ms for a given setup length (10, 20, or 0 = "all"). */
export function examDurationMs(length: number): number {
  const minutes = length === 10 ? 30 : length === 20 ? 60 : 90;
  return minutes * 60_000;
}
```

`length` only ever comes from the exam's 10 / 20 / All control, so the ternary
covers every real case; `0` ("all") and any unexpected value fall to 90 min.

### 6.2 `useCountdown` — `src/lib/use-countdown.ts`

```ts
/** Counts down from `startedAt + durationMs`. Re-renders ~1×/s. */
export function useCountdown(
  startedAtMs: number,
  durationMs: number,
): { remainingMs: number; expired: boolean };
```

- `remainingMs = Math.max(0, startedAtMs + durationMs - Date.now())`, recomputed
  on a 1 s `setInterval` and once on mount. `expired = remainingMs === 0`.
- Anchored to wall-clock, so background-tab throttling can't slow the exam.
- The interval clears itself once `expired`.

### 6.3 `ExamTimer` display

A small component fed `remainingMs`: renders `mm:ss` (client-formatted digits —
no i18n for the number), with an `aria-label` from `exam.session.timeLeft`.
Applies a warning style (e.g. `text-error-strong`) when
`remainingMs < 5 * 60_000`. Pinned to the top of the exam, above the question.

## 7. Session UI — one question per page + navigator

### 7.1 `ExamSession` state (rewrite)

Props unchanged: `{ questions: PracticeQuestion[]; onSubmit: (answers:
(number | null)[]) => void }` plus a new `startedAtMs: number` and `length:
number`. `ExamSession` derives `durationMs = examDurationMs(length)` and passes
`(startedAtMs, durationMs)` to `useCountdown`.

State:

- `index: number` — current question (0-based).
- `answers: (number | null)[]` — length `questions.length`, init all `null`.
  Selecting an option sets `answers[index]`; options are **not** locked (exam —
  the answer can be changed, no feedback).
- `pinned: boolean[]` — length `questions.length`, init all `false`.
- `submitted` guard so a manual Hand-in and the timer can't both fire
  `onSubmit`.
- `timeUp: boolean` — set from `useCountdown().expired`.

### 7.2 Layout

- Desktop (`lg+`): two columns — the question column (`max-w-[42rem]`) and a
  right rail holding `ExamNavigator`. The page container switches from centered
  to `lg:flex-row lg:justify-center lg:gap-8`.
- Mobile (`< lg`): the navigator is a collapsible disclosure directly below the
  timer — a toggle button labelled with `exam.session.navigatorTitle` and the
  live "answered {n} / {total}" count, expanding to the same numbered grid.

### 7.3 Per-question page

`ExamTimer` · `Question {index+1} of {total}` · a **pin** toggle button
(`exam.session.pin` / `exam.session.unpin`, aria-pressed reflects `pinned[index]`).
For a reading question, `PassagePanel` (bounded, scrollable) sits above the
prompt. Then the prompt and the `OptionButton` list (state `selected` /
`idle`, no correct/wrong — exam gives no feedback). Then **Previous**
(disabled at `index === 0`) and **Next** (disabled at the last question).

### 7.4 `ExamNavigator` — `src/features/exam/exam-navigator.tsx`

```ts
{
  count: number;
  current: number;
  answered: boolean[];
  pinned: boolean[];
  onJump: (index: number) => void;
}
```

A titled (`exam.session.navigatorTitle`) grid of `count` numbered buttons.
Per cell: **answered** → filled/primary; **not answered** → muted/outline;
**current** → ring; **pinned** → a small flag badge (independent of
answered/unanswered). `onJump(i)` sets `index`. A legend row explains the
colours. Below it, the `exam.session.answered` counter (reused) and the
**Hand in** button.

### 7.5 Hand in

Available on every page (in the navigator on desktop, in a sticky footer on
mobile). On click: if `answered.filter(Boolean).length < count` **or** any
`pinned`, show a confirm panel — `exam.session.handInConfirm.body` with the
unanswered and flagged counts, `confirm` / `cancel`. Otherwise submit straight
away. Submit = set `submitted`, call `onSubmit(answers)`.

### 7.6 Time's up

When `timeUp` and not `submitted`: the question area (prompt + options + nav
buttons) is replaced by a panel — `exam.session.timeUp.title` /
`exam.session.timeUp.body` and a **See results** button
(`exam.session.timeUp.viewResults`). A 10 s `setTimeout` calls the same submit
path; clicking the button does it immediately. The navigator and timer (showing
`00:00`) stay visible but inert.

## 8. Leaving mid-exam

- `ExamView`: while `phase.name === "session"`, attach a `beforeunload` listener
  that calls `event.preventDefault()` (triggers the browser's generic
  "Leave site?" prompt). Detach it on unmount and when leaving the session
  phase.
- No in-app navigation guard (see §3). No "start over" control is rendered
  during the session — the only ways out are Hand in, the timer, or leaving the
  page.
- `onAgain` on the results screen already resets `startedAtRef` and returns to
  setup — unchanged.

## 9. Results — essentially unchanged

`exam-results.tsx`: replace the inline `const PASS_THRESHOLD = 55` with
`import { EXAM_PASS_THRESHOLD } from "@/lib/exam-rules"`. Everything else
(percent, score line, pass/fail pill, `QuestionReviewList`, action buttons)
stays. `buildStudyRunInput` already records the run correctly
(`kind: 'exam'`, `mode: null`, `scope: 'level'`, `level`, counts, timestamps) —
no change.

## 10. i18n — new keys (both `en.json` and `nl.json`)

Under `exam.session`:

| key | en | nl |
| --- | --- | --- |
| `timeLeft` | `Time left` | `Resterende tijd` |
| `pin` | `Flag for review` | `Markeer om terug te komen` |
| `unpin` | `Remove flag` | `Verwijder markering` |
| `prev` | `Previous` | `Vorige` |
| `next` | `Next` | `Volgende` |
| `navigatorTitle` | `Questions` | `Vragen` |
| `navigatorAnswered` | `Answered` | `Beantwoord` |
| `navigatorUnanswered` | `Not answered` | `Niet beantwoord` |
| `navigatorFlagged` | `Flagged` | `Gemarkeerd` |
| `timeUp.title` | `Time is up` | `De tijd is om` |
| `timeUp.body` | `Your exam has been handed in.` | `Je examen is ingeleverd.` |
| `timeUp.viewResults` | `See results` | `Bekijk resultaten` |
| `handInConfirm.title` | `Hand in now?` | `Nu inleveren?` |
| `handInConfirm.body` | `{unanswered} unanswered, {flagged} flagged. You can't change anything after handing in.` | `{unanswered} onbeantwoord, {flagged} gemarkeerd. Na inleveren kun je niets meer wijzigen.` |
| `handInConfirm.confirm` | `Hand in` | `Inleveren` |
| `handInConfirm.cancel` | `Keep working` | `Doorgaan` |

`exam.setup.about.points` is rewritten to describe the real exam:

| en | nl |
| --- | --- |
| `Mixed questions — one third reading, grammar, and vocabulary` | `Gemengde vragen — een derde lezen, grammatica en woordenschat` |
| `Timed: 30 min for 10 questions, 1 h for 20, 1½ h for all` | `Met tijdslimiet: 30 min voor 10 vragen, 1 uur voor 20, 1½ uur voor alle` |
| `One question per page; flag any to revisit; no feedback until you hand in` | `Eén vraag per pagina; markeer vragen om terug te komen; geen feedback tot je inlevert` |

Existing `exam.session.answered` / `unanswered` / `handIn` / `questionNumber`
and all `exam.results.*` keys are kept.

## 11. Error handling & edge cases

| Situation | Behaviour |
| --- | --- |
| Chosen level has no items | Start disabled, "not enough material" copy (existing) |
| Level has items but a whole type is empty | Fixed length: deficit redistributed to the other two types; "all": `min` is 0 → Start disabled |
| Fixed length larger than the level's balanced supply | Exam runs with fewer than `length` questions; the timer for that length still applies |
| Reading pool larger than its third | Only the first N reading questions (hash order) are taken; the rest sit out |
| A passage contributes 6 questions but the reading third is 4 | 4 of that passage's questions appear (each on its own page, passage shown above); the other 2 are unused. Passages are **not** kept whole in an exam |
| Timer expires while the tab is backgrounded | Wall-clock anchor → on return, `remainingMs` is already 0, `timeUp` fires immediately, auto-submit proceeds |
| User clicks Hand in and the timer expires in the same tick | `submitted` guard — `onSubmit` runs once |
| `beforeunload` fired but user cancels | Nothing changes; the exam and its clock continue (the clock never paused) |
| Navigator jump to an answered question | Shows the stored selection; still changeable |
| `answers` all null at submit (walked away, came back at 0:00) | Graded as 0 correct; pass/fail pill shows "Not passed" |

## 12. Testing

Provider-free; no live DB, no live AI. Server tests `// @vitest-environment
node`; component tests jsdom + the next-intl namespace stub; timer tests use
`vi.useFakeTimers()`.

| File | Covers |
| --- | --- |
| `src/server/services/exam-composition.test.ts` | length 10 → 4/3/3, length 20 → 7/7/6; remainder priority reading→grammar→vocab; shortfall redistribution (empty grammar pool → its 3 go to reading/vocab); "all" → `3 × min(pools)`; empty pool → `[]`; deterministic for a fixed input |
| `src/server/services/practice-service.test.ts` (extend) | `generateExamQuestions`: filters to `setup.level`; returns a balanced set for 10/20; ignores `setup.mode` (always mixed); no second `listKnowledgeItems` call. `generatePracticeQuestions` output unchanged (existing assertions still pass after the builder refactor) |
| `src/lib/exam-rules.test.ts` | `examDurationMs` 10→30 min, 20→60 min, 0→90 min, fallback→90 min; `EXAM_PASS_THRESHOLD === 55` |
| `src/lib/use-countdown.test.ts` (node) | `remainingMs` decreases each second; hits 0 and sets `expired`; never negative; interval cleared after expiry (fake timers) |
| `src/features/exam/exam-navigator.test.tsx` | cell classes per state (answered / unanswered / current / pinned); `onJump(i)` fires with the clicked index; legend + answered counter render |
| `src/features/exam/exam-session.test.tsx` (rewrite) | one question shown at a time; Prev disabled at 0, Next disabled at last; answering marks the navigator cell + counter; pin toggles cell badge + `aria-pressed`; Hand in with unanswered/flagged shows the confirm, `confirm` calls `onSubmit`, `cancel` dismisses; time's-up panel replaces the question, locks input, and auto-submits after the timeout (fake timers); `submitted` guard prevents a double `onSubmit` |
| `src/features/exam/exam-view.test.tsx` (new or extend) | passes `variant="exam"` to `SetupForm`; attaches a `beforeunload` listener during the session phase and removes it on results/unmount |
| `src/components/shared/setup-form.test.tsx` (extend) | `variant="exam"`: no mode buttons; scope select offers only "By level"; level select always visible; length group unchanged. `variant` unset: today's render is untouched |

## 13. File-change summary

**New**

- `src/server/services/exam-composition.ts` (+ `.test.ts`)
- `src/lib/exam-rules.ts` (+ `.test.ts`)
- `src/lib/use-countdown.ts` (+ `.test.ts`)
- `src/features/exam/exam-timer.tsx`
- `src/features/exam/exam-navigator.tsx` (+ `.test.ts`)

**Changed**

- `src/components/shared/setup-form.tsx` — `variant` prop (+ test)
- `src/server/services/practice-service.ts` — extract per-type builders; real
  `generateExamQuestions` (+ test extensions)
- `src/features/exam/exam-view.tsx` — exam-only setup, timer wiring,
  `beforeunload` guard, prop cleanup
- `src/features/exam/exam-session.tsx` — full rewrite (one-per-page, navigator,
  timer, pin, time's-up, hand-in confirm) (+ test rewrite)
- `src/features/exam/exam-results.tsx` — `EXAM_PASS_THRESHOLD` import
- `src/features/exam/index.ts` — export new components if needed
- `src/app/(app)/exam/page.tsx` — always level scope; drop `?scope` / custom
  filter
- `src/messages/en.json`, `src/messages/nl.json` — the §10 keys

## 14. Gates

`npm run typecheck`, `npm run lint`, `npm test`. Run `npx next typegen` before
`typecheck` if `PageProps` errors appear (the exam page's props change). **Not**
`npm run format` / prettier (red repo-wide). Commit trailer:
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` plus the
`Claude-Session` trailer.
