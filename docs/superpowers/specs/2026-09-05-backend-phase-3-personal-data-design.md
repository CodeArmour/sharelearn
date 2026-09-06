# Backend Phase 3 — Personal Data Persistence

**Date:** 2026-09-05
**Status:** Approved design — pending implementation plan
**Scope:** Move the two remaining pieces of per-user state off the client and
into Postgres, scoped per `(user, group)`:

1. **Review marks** — currently `localStorage` (`src/lib/review-marks.ts`).
2. **Practice / exam run history** — currently in-memory only; the results
   screens say "not saved" and the profile Progress section is an honest
   placeholder.

**Summary rows only.** One row per finished run (mode, scope, counts,
timestamps). No per-question storage, no per-item "times seen / times correct"
rollup, no streak / activity-calendar concept. Files, AI, and any new practice
mechanics stay out of scope (see §10).

---

## 1. Context

Phases 1 (auth, groups, invitations, gated shell) and 2 (shared library data in
Postgres) are done and merged to `main`. The knowledge-item edit/delete
follow-up is merged (PR #4); its Task 8 manual-verification pass is still
outstanding but does not block this phase.

Everything under `(app)/` is auth-gated and group-scoped. The request flow and
conventions are fixed by Phases 1–2 and documented in `src/server/README.md`:

```
Browser
 -> Server Component            -> server/services/*            (direct call)
 -> Server Action ("use client" -> server/actions/*  (zod, ActionResult<T>)
     callers only)                  -> server/services/*
                                        -> server/repositories/*
                                            -> server/db/client.ts
```

Services resolve the actor + active group themselves via
`resolveActiveContext()` — they never trust a caller-supplied id. RLS is enabled
on every table as defense-in-depth; the app connects as the table owner and
bypasses RLS in normal operation, so **the service layer is the primary guard**
(same stance as `0003_knowledge_rls` / `0006_knowledge_update_rls`).

### What Phase 3 replaces

| Concern | Today | After Phase 3 |
| --- | --- | --- |
| Review marks | `src/lib/review-marks.ts` — `localStorage` key `dutch:review-marks`, `useSyncExternalStore`, array of `{ knowledgeId, markedAt }`. Consumed by `knowledge-actions`, `vocabulary-table`, `practice-view`, `exam-view`, profile `progress-section` + `review-list-section`. | Same `useReviewMarks()` public API, backed by `review_marks` in Postgres via a Server Action; `localStorage` demoted to a first-paint cache. Existing local marks migrated once. |
| Practice run | Pure in-memory client machine in `practice-view.tsx`; results screen shows `t("...results.notSaved")`. | `onComplete` fires `recordStudyRunAction`; results screen shows a saving / saved / retry state. One `study_runs` row (`kind = 'practice'`). |
| Exam run | Same, `exam-view.tsx`. | Same, `kind = 'exam'`. |
| Profile Progress | `progress-section.tsx` — placeholder text + marked count (from the hook) + library totals. | Real: runs completed, average score, marked count (server prop), and a list of the last ~10 runs. |

### Draft types that already exist

`src/types/personal.ts` drafts `ReviewMark`, `PracticeMode`,
`PracticeResultSummary`, `ExamResultSummary`. Phase 3 keeps `ReviewMark` and
`PracticeMode` as-is, and reshapes the two result-summary types into views over
a single `study_runs` model (§4). These types are only referenced by the client
today (drafts), so changing them is safe.

## 2. Decisions locked before design

| Decision | Choice | Rationale |
| --- | --- | --- |
| Run detail | **Summary row per run**, no per-question or per-item tables | The roadmap item is "results persistence." Per-question / weak-item analytics is a distinct feature with its own UI; building the tables now is speculative. |
| One table vs two | **Single `study_runs` table**, `kind` discriminator (`'practice' \| 'exam'`) | Practice and exam runs are ~90 % the same shape. Two tables would duplicate the repo, RLS policy, migration, and the profile's history merge for no gain. `PracticeResultSummary` / `ExamResultSummary` become two views over it. |
| Run context | Persist **`scope` enum + `level`** (when `scope = 'level'`); not the full filter | Enough for a readable history line ("A2 · practice · 12/15"). Snapshotting the whole `PracticeFilter` would store free-text search terms and member ids indefinitely for no profile benefit. |
| `score_percent` | **Derived, not stored** — `round(correct / total * 100)` in the repo mapper | Single source of truth; matches how `practice-results.tsx` / `exam-results.tsx` compute it today. Avoids a denormalised column that can drift. |
| Tenancy | Every row scoped by **`(user_id, group_id)`**; RLS gated on `user_id = auth.uid() AND is_group_member(group_id)` | A user can belong to multiple groups; marks reference group-scoped knowledge and runs draw from a group's library. Direct extension of the Phase 1–2 tenancy model. |
| History append-only | `study_runs` has **no `UPDATE` / `DELETE`** policy or service path | It is a log. "Practice again" produces a new row. No edit/delete UI is in scope. |
| Review-marks migration | **Keep `useReviewMarks()`'s public API**, swap internals; one-time import of existing `localStorage` marks | Five consumers stay untouched. The file's own comment already anticipates this ("swap `read`/`write` for API calls later and consumers don't change"). |
| Save UX | **Save once on finish, fire-and-forget**; results screen reflects saving / saved / retry | Not blocking the score behind a network round-trip. A failed save is recoverable with a Retry button; a lost save is a tolerable edge for a study log. |
| Progress read path | `getStudyHistory()` is a **service call from the profile Server Component** — no Server Action | Only one Server-Component reader, same as `getLibraryStats()`. Actions exist only for `"use client"` callers. |

## 3. Architecture & layering

One new vertical slice, same shape as Phase 2.

### `server/` modules added in Phase 3

| Module | Responsibility |
| --- | --- |
| `db/schema.ts` (extended) | `study_run_kind` enum; `review_marks` + `study_runs` tables with CHECK constraints; `$inferSelect` / `$inferInsert` exports |
| `db/migrations/0007_*` | generated — enum + two tables + indexes + CHECKs |
| `db/migrations/0008_personal_rls.sql` | hand-written — `ENABLE ROW LEVEL SECURITY` + policies, mirrors `0003` (the plan may instead fold RLS into a hand-edited `0007`, as `0003` did for Phase 2 — either is fine as long as the journal stays ordered) |
| `db/seed.ts` (extended) | idempotently seed a few `study_runs` + a handful of `review_marks` for the seed owner so a fresh dev DB / first preview deploy shows a non-empty Progress section |
| `repositories/personal.ts` | `listReviewMarks`, `addReviewMark`, `removeReviewMark`, `replaceReviewMarks`, `insertStudyRun`, `listStudyRuns`, `getStudyRunTotals` — all `(userId, groupId)`-scoped, no authorization logic |
| `repositories/personal.integration.test.ts` | real-DB round-trip + RLS smoke (gated on a genuine throwaway DB — see §11) |
| `services/personal-service.ts` | `getReviewMarks`, `toggleReviewMark`, `importLocalReviewMarks`, `recordStudyRun`, `getStudyHistory` — resolve actor + group via `resolveActiveContext()` |
| `services/personal-service.test.ts` | unit tests, repository mocked |
| `actions/personal.ts` | `getReviewMarksAction`, `toggleReviewMarkAction`, `importLocalReviewMarksAction`, `recordStudyRunAction` — zod validation, `ActionResult<T>`, `toActionError` |
| `actions/schemas.ts` (extended) | `studyRunInputSchema`; reuse `knowledgeItemIdSchema` / `knowledgeIdsSchema` |

### Client callers that need a Server Action

Per the Phase 1 invariant ("client components never import from `src/server/`"),
these `"use client"` modules get actions rather than direct service calls:

| Client module | New call |
| --- | --- |
| `src/lib/review-marks.ts` | `getReviewMarksAction`, `toggleReviewMarkAction`, `importLocalReviewMarksAction` |
| `src/features/practice/practice-view.tsx` | `recordStudyRunAction` |
| `src/features/exam/exam-view.tsx` | `recordStudyRunAction` |

`src/app/(app)/profile/page.tsx` is a Server Component and calls
`getStudyHistory()` on the service directly, alongside its existing
`getLibraryStats()` call.

## 4. Data model

### Enum

- `study_run_kind` = `('practice', 'exam')`.

`mode`, `scope`, and `level` stay `text` with app-level `CHECK` constraints
rather than enums — same reasoning as Phase 2's `level` column (avoids an enum
migration every time `PracticeMode` / `PracticeScope` / `CEFR_LEVELS` shift; the
constraint gives equivalent safety).

### `review_marks`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` not null | references `auth.users(id)` on delete cascade |
| `group_id` | `uuid` not null | references `groups(id)` on delete cascade |
| `knowledge_id` | `uuid` not null | references `knowledge_items(id)` on delete cascade — deleting an item drops its marks for everyone |
| `marked_at` | `timestamptz` not null default `now()` | |

- **Primary key:** composite `(user_id, group_id, knowledge_id)`. Toggle-on is
  `INSERT … ON CONFLICT DO NOTHING`; toggle-off is `DELETE`. Idempotent both ways.
- **Index:** `(user_id, group_id)` — the "my marks in this group" read.
- No soft delete — un-marking is a real delete; there is no history requirement
  for marks.

`knowledge_items` FK cascade note: `knowledge_items` uses a *soft* delete
(`deleted_at`), so a soft-deleted item's marks are **not** cascaded away by the
DB. The repo's read (`listReviewMarks`) joins to `knowledge_items` and filters
`deleted_at IS NULL`, so a soft-deleted item silently drops out of a user's mark
set — consistent with how it already drops out of Library / practice pools. A
hard delete of the row (none today) would cascade.

### `study_runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `user_id` | `uuid` not null | references `auth.users(id)` on delete cascade |
| `group_id` | `uuid` not null | references `groups(id)` on delete cascade |
| `kind` | `study_run_kind` not null | |
| `mode` | `text` | CHECK: `mode IN ('vocabulary','grammar','reading','mixed')`; **`mode IS NOT NULL` iff `kind = 'practice'`** (exams are always mixed and carry `null`) |
| `scope` | `text` not null | CHECK: `scope IN ('all','today','level','custom','review')` |
| `level` | `text` | CHECK: `level IS NULL OR level IN ('A1','A2','B1','B2','C1','C2')`; set only when `scope = 'level'` (enforced in the service, not the DB) |
| `question_count` | `integer` not null | CHECK: `question_count > 0` |
| `correct_count` | `integer` not null | CHECK: `correct_count BETWEEN 0 AND question_count` |
| `started_at` | `timestamptz` not null | from the client session machine |
| `completed_at` | `timestamptz` not null default `now()` | |

- **CHECK `study_runs_mode_kind`:** `(kind = 'practice') = (mode IS NOT NULL)`.
- **CHECK `study_runs_counts`:** `question_count > 0 AND correct_count >= 0 AND correct_count <= question_count`.
- **Index:** `(user_id, group_id, completed_at DESC)` — the history-list read
  and the totals aggregate both use it.
- No `updated_at`; rows are immutable.

### Type reshaping (`src/types/personal.ts`)

Replace `PracticeResultSummary` / `ExamResultSummary` with a single shape plus
the derived field:

```ts
export type StudyRunKind = "practice" | "exam";

/** One finished practice or exam run (personal history). */
export interface StudyRunSummary {
  id: string;
  kind: StudyRunKind;
  /** null for exams. */
  mode: PracticeMode | null;
  scope: PracticeScope;
  /** present only when scope === "level". */
  level: string | null;
  questionCount: number;
  correctCount: number;
  /** 0–100, derived: round(correctCount / questionCount * 100). */
  scorePercent: number;
  startedAt: string;
  completedAt: string;
}
```

`PracticeScope` is imported from `src/types/practice.ts` (it already lives
there). `ReviewMark` and `PracticeMode` are unchanged.

## 5. Server layer

### `repositories/personal.ts`

All functions take explicit `userId` / `groupId`; none read auth or cookies.

| Function | Behaviour |
| --- | --- |
| `listReviewMarks(userId, groupId)` | `SELECT rm.knowledge_id, rm.marked_at FROM review_marks rm JOIN knowledge_items ki ON ki.id = rm.knowledge_id WHERE rm.user_id = $1 AND rm.group_id = $2 AND ki.deleted_at IS NULL` → `ReviewMark[]` ordered by `marked_at` desc |
| `addReviewMark(userId, groupId, knowledgeId)` | Guard: `SELECT 1 FROM knowledge_items WHERE id = $knowledgeId AND group_id = $groupId AND deleted_at IS NULL` — if absent, throw `NotFoundError` (stops a cross-group / deleted-item mark even on the RLS-bypassing owner connection). Then `INSERT … ON CONFLICT (user_id, group_id, knowledge_id) DO NOTHING`. |
| `removeReviewMark(userId, groupId, knowledgeId)` | `DELETE …`. No error if the row was already gone. |
| `replaceReviewMarks(userId, groupId, knowledgeIds)` | One transaction. **No-op if the user already has any mark in the group** (server-wins). Otherwise bulk-insert, each id passed through the same knowledge-item guard; silently skip ids that fail it. Used only by the migration path. |
| `insertStudyRun(userId, groupId, input)` | `INSERT` one row; return it mapped to `StudyRunSummary` (computes `scorePercent`). |
| `listStudyRuns(userId, groupId, limit)` | `… ORDER BY completed_at DESC LIMIT $limit` → `StudyRunSummary[]`. |
| `getStudyRunTotals(userId, groupId)` | `SELECT count(*) AS run_count, coalesce(round(avg(correct_count::numeric / question_count * 100)), 0) AS avg_score_percent FROM study_runs WHERE …` → `{ runCount: number; avgScorePercent: number }`. |

### `services/personal-service.ts`

Each entry resolves context first; throws `NotFoundError("No active group")`
when `resolveActiveContext()` is not `ok` — same helper shape as
`practice-service.ts`'s `requireActiveGroupId()`.

| Function | Behaviour |
| --- | --- |
| `getReviewMarks()` | `listReviewMarks(user.id, activeGroup.id)`. |
| `toggleReviewMark(knowledgeId)` | Read current membership of the mark (a cheap `SELECT 1`), then `add` or `remove`. Return `{ marked: boolean }` (the new state). |
| `importLocalReviewMarks(knowledgeIds)` | Dedupe + drop non-UUIDs, call `replaceReviewMarks`. Return `{ imported: number }` (0 when server-wins skipped it). |
| `recordStudyRun(input)` | Validate coherence beyond zod: `correctCount <= questionCount`; `mode` present iff `kind === 'practice'`; `level` present iff `scope === 'level'` (else force it to `null`); `startedAt <= completedAt`. Throw `ValidationError` on violation. Then `insertStudyRun`. Return the `StudyRunSummary`. |
| `getStudyHistory(limit = 10)` | `Promise.all([listStudyRuns(…, limit), getStudyRunTotals(…), listReviewMarks(…)])` → `{ runs, totals: { runCount, avgScorePercent }, markedCount }`. |

### `actions/personal.ts`

`"use server"`. Every export returns `ActionResult<T>`; validate with zod, then
`try { … } catch (e) { return { ok: false, ...toActionError(e) }; }` — identical
pattern to `actions/practice.ts` / `actions/knowledge.ts`.

| Action | Input schema | Success data |
| --- | --- | --- |
| `getReviewMarksAction()` | — | `ReviewMark[]` |
| `toggleReviewMarkAction(knowledgeId)` | `knowledgeItemIdSchema` | `{ marked: boolean }` |
| `importLocalReviewMarksAction(ids)` | `knowledgeIdsSchema` | `{ imported: number }` |
| `recordStudyRunAction(input)` | `studyRunInputSchema` | `StudyRunSummary` |

### `actions/schemas.ts` addition

```ts
export const studyRunInputSchema = z
  .object({
    kind: z.enum(["practice", "exam"]),
    mode: z.enum(["vocabulary", "grammar", "reading", "mixed"]).nullable().default(null),
    scope: z.enum(["all", "today", "level", "custom", "review"]),
    level: z.enum(CEFR_LEVELS).nullable().default(null),
    questionCount: z.number().int().positive(),
    correctCount: z.number().int().min(0),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
  })
  .refine((v) => v.correctCount <= v.questionCount, { message: "correctCount exceeds questionCount" })
  .refine((v) => (v.kind === "practice") === (v.mode !== null), { message: "mode required iff practice" });
```

The service still re-checks the cross-field rules — zod is the shape gate, the
service is the invariant gate (same split as Phase 2).

## 6. Review-marks client migration

`src/lib/review-marks.ts` keeps its **exact public surface**:

```ts
export function getReviewMarks(): ReviewMark[]
export function toggleReviewMark(knowledgeId: string): void   // stays sync-looking (fire-and-forget inside)
export function useReviewMarks(): [Set<string>, (knowledgeId: string) => void]
```

so `knowledge-actions.tsx`, `vocabulary-table.tsx`, `practice-view.tsx`,
`exam-view.tsx`, `progress-section.tsx`, and `review-list-section.tsx` do not
change their calls. (`progress-section.tsx` additionally gets `markedCount` as a
server prop per §8 and stops depending on the hook for that number — but the
hook call itself can stay or go with no API break.)

### Internals

- **`localStorage` (`dutch:review-marks`) becomes a cache**, not the source of
  truth. `getSnapshot()` still reads it synchronously for first paint.
- **Hydration.** A module-level hydration routine (invoked from a small
  `<ReviewMarksHydrator/>` mounted in the `(app)` layout, or lazily on first
  `useReviewMarks` mount) calls `getReviewMarksAction()` once per session,
  replaces the in-memory `Set` + cache with the server's set, and fans out the
  existing change event.
- **Toggle = optimistic + write-through.** `toggleReviewMark(id)` flips the
  in-memory `Set` and cache immediately (existing `useSyncExternalStore`
  fan-out unchanged), then fires `toggleReviewMarkAction(id)`. On failure:
  revert the optimistic entry, fan out again (the bookmark icon visibly
  reverts), and `console.error` — no new error-UI component.
- **One-time import.** During the first hydration where the server set is empty
  *and* the cache holds ≥1 UUID mark, call `importLocalReviewMarksAction(ids)`,
  then adopt the server result. A `dutch:review-marks-migrated` flag in
  `localStorage` makes this run at most once per browser. If the user already
  had server marks (second device), the import is a no-op by `replaceReviewMarks`'s
  server-wins rule.
- **SSR / signed-out.** `getServerSnapshot()` stays `new Set()`. There is no
  signed-out state inside `(app)`; the first server render shows nothing, same
  as today.
- **Cross-tab.** The `storage` + `dutch:review-marks-change` events still keep
  the cache in sync between tabs. A background tab won't observe another tab's
  *server* write until its own next hydration — acceptable; it was
  localStorage-only before.
- **Stale-id hygiene.** The existing `UUID_RE` filter on read stays (pre-Phase-2
  mock ids like `kn_gezellig` still self-heal out); `knowledgeIdsSchema`
  already drops them server-side too.

## 7. Saving runs & the results screen

### Capturing the run

`practice-view.tsx` and `exam-view.tsx` are three-phase client machines
(`setup → session → results`). Two changes each:

1. **`startedAt`.** On the `setup → session` transition, set a
   `useRef<string>` to `new Date().toISOString()`. (Neither machine tracks a
   start time today.)
2. **Save on finish.** The `onComplete` (practice) / `onSubmit` (exam) handler,
   which currently only does `setPhase({ name: "results", … })`, additionally
   builds the input and calls `recordStudyRunAction(input)` — **not awaited**;
   the transition to the results phase happens synchronously.

Input built client-side:

```ts
{
  kind: "practice" | "exam",
  mode: view === "exam" ? null : setup.mode,
  scope: setup.scope,
  level: setup.scope === "level" ? (setup.level ?? null) : null,
  questionCount: questions.length,
  correctCount: answers.filter((a, i) => a === questions[i].correctIndex).length,
  startedAt: startedAtRef.current,
  completedAt: new Date().toISOString(),
}
```

### Results screen save state

The view owns the action call and tracks
`saveState: "saving" | "saved" | "error"`, passed as a prop into
`practice-results.tsx` / `exam-results.tsx`, which today render a static
`t("results.notSaved")` caption. New rendering:

| State | Copy key | Extra |
| --- | --- | --- |
| `saving` | `results.saving` — "Saving…" | — |
| `saved` | `results.saved` — "Saved to your progress" | — |
| `error` | `results.saveError` — "Couldn't save this run" | a **Retry** button (`results.retry`) that re-fires `recordStudyRunAction` with the same input |

`onAgain` ("Practice again") resets to `setup`; the next finished run is a fresh
`recordStudyRunAction` call → a new row. A refresh on the results screen loses
the client state, but the run is already persisted.

### i18n

- **Remove:** `practice.results.notSaved`, `exam.results.notSaved`,
  `profile.progress.placeholder`.
- **Add** (both `nl.json` and `en.json`, identical key trees, NL is the length
  stress-case): `practice.results.saving/saved/saveError/retry`,
  `exam.results.saving/saved/saveError/retry`, and the profile keys in §8.

## 8. Profile Progress section

`src/app/(app)/profile/page.tsx` (Server Component) already calls
`getLibraryStats()`. Add a parallel `getStudyHistory(10)` and thread
`{ runs, totals, markedCount }` through `ProfileView` → `ProgressSection`.

`src/features/profile/progress-section.tsx` stops being a placeholder:

- **Headline numbers:**
  - runs completed — `totals.runCount`
  - average score — `totals.avgScorePercent`, rendered `…%`
  - items marked — `markedCount` (server prop; stable on first paint, no longer
    `useReviewMarks().size`)
- **Recent runs list** — up to 10 rows, newest first. Each row:
  - date (`completedAt`, formatted via the existing date helper / `next-intl`)
  - a `practice` / `exam` chip
  - label: the `mode` (practice) or "Exam" (exam)
  - scope label: `all` / `today` / `custom` / `review` → localized words; `level`
    → the CEFR code. Phrasing style like the existing
    `buildFilterSummary` output ("A2 · Vocabulary").
  - `correctCount / questionCount · scorePercent%`
  - Empty state (no runs): one line, `profile.progress.noRuns`.
- **Library-totals sub-row** (per-type counts) — unchanged.
- `progress-section.tsx` likely no longer needs `"use client"` once `markedCount`
  is a prop; convert to a Server Component if nothing else forces client. If some
  interaction keeps it client, still take `markedCount` as a prop rather than
  reading the hook for the headline number.

**New i18n keys** (both locales): `profile.progress.runsCompleted`,
`profile.progress.avgScore`, `profile.progress.recentRuns`,
`profile.progress.noRuns`, `profile.progress.run.practice`,
`profile.progress.run.exam`, plus any scope-word keys not already under
`practice.*` that the row label needs.

`review-list-section.tsx` and the `scope=review` practice flow are unchanged —
review marks still feed practice the same way, now from the server-backed store.

## 9. Seed data

Extend `src/server/db/seed.ts` (idempotent, same spirit as Phase 2 seeding the
11 library items):

- ~4–6 `study_runs` for the seed owner in the seeded group — a mix of
  `practice` / `exam`, varied `mode` / `scope` / scores, `completed_at` spread
  over the last ~2 weeks.
- ~3 `review_marks` for the seed owner pointing at seeded vocabulary items.

Idempotency: key the run inserts on a deterministic `(user_id, group_id,
completed_at)` (or delete-then-insert the owner's seeded rows) so re-running
`db:seed` doesn't stack duplicates. Marks are naturally idempotent via the
composite PK.

## 10. Out of scope for Phase 3

- **Per-question / per-item analytics** — no `study_run_answers` table, no
  "times seen / times correct" rollup, no "weak items" view.
- **Streak / activity calendar / daily goal** — not modelled.
- **Editing or deleting history** — `study_runs` is append-only; no UI.
- **Today-page progress surfacing** — the Progress numbers live only on the
  profile page; `today/page.tsx` is untouched.
- **Cross-group aggregate view** — history is per active group, like everything
  else.
- **Files** (`FileItem.url` still `null`), **AI** (`src/ai/` still simulated) —
  unchanged, as in Phase 2.
- **Retry/queue durability for a failed save** beyond the in-screen Retry
  button — a dropped run that the user navigates away from is lost.

## 11. Testing

- **Unit (`personal-service.test.ts`)** — repository mocked:
  - `toggleReviewMark` flips add ↔ remove and returns the new state.
  - `recordStudyRun` rejects `correctCount > questionCount`, a practice run with
    `mode: null`, an exam run with a non-null `mode`, `startedAt > completedAt`;
    forces `level = null` when `scope !== 'level'`.
  - `importLocalReviewMarks` dedupes, drops non-UUIDs, returns `imported: 0`
    when the repo reports server-wins.
  - Every entry throws `NotFoundError` when `resolveActiveContext()` is not `ok`
    (context mocked).
  - `getStudyHistory` shape: `runs` capped at `limit`, `markedCount` matches.
- **Schema (`schema.test.ts` addition)** — the new CHECKs exist with the
  expected predicates (this file already asserts constraint presence for Phase 2).
- **Action (`schemas.test.ts` addition)** — `studyRunInputSchema` accepts a
  valid practice + valid exam payload, rejects the cross-field violations.
- **Integration (`personal.integration.test.ts`)** — real-DB round-trip:
  insert/list/totals for `study_runs`; add/remove/list + `ON CONFLICT` for
  `review_marks`; the soft-deleted-item drop-out on `listReviewMarks`; an RLS
  smoke test (a second user cannot see the first's rows).
  - **Blocked until a genuine throwaway DB exists.** `src/test/db.ts`'s
    `resetTables()` now refuses to run against the dev host (commit `7877e8e`)
    after two live-DB data-loss incidents. This suite must `describe.skip` (or
    guard on `TEST_DATABASE_URL` pointing at a non-dev host) exactly like the
    Phase 2 integration files until a disposable Supabase project / local CLI
    stack is provisioned. Provisioning it is a prerequisite task in the plan,
    not part of this design.
- **Gates stay green after every task:**
  `npm test && npm run typecheck && npm run lint && npm run build`.

## 12. Migration & rollout notes

- **Migration numbering:** next is `0007` (+ optional `0008` for RLS). The
  `when` value in `src/server/db/migrations/meta/_journal.json` for each new
  entry **must be strictly greater** than `0006`'s `1788677000000` — an
  out-of-order timestamp made drizzle-kit silently skip `0005`/`0006` during the
  knowledge branch. Verify the columns actually exist via `information_schema`
  after `npm run db:migrate`, not just the command's exit code.
- **RLS helpers:** reuse `is_group_member(group_id)` from
  `0004_fix_recursive_rls.sql`. Do not re-query `group_memberships` inline in a
  policy (the recursion bug `0004` fixed).
- **Deploy order:** migration first, then the app. The client-side review-marks
  swap degrades safely if the action 500s mid-rollout (optimistic state + cache
  still work locally; the run save shows Retry).
- **`AGENTS.md` / `CLAUDE.md` block** is regenerated by `next dev`; if it
  reappears as an uncommitted change, commit it with the work.
- **Commit trailer** on every commit in the plan:

  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016rbE3qnd2dVf15UVABLvye
  ```
