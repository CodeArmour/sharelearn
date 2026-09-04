# Backend Phase 2 — Shared Library Data

**Date:** 2026-09-04
**Status:** Approved design — pending implementation plan
**Scope:** Move the shared knowledge library (vocabulary, grammar, readings, notes)
from `src/data/mock/` into Postgres, scoped per group. Manual capture in the Add
flow persists for real. Practice/exam question generation reads from the
database. **Files stay mocked** (`FileItem.url` stays `null`); practice/exam
**result** persistence and review marks stay out of scope (Phase 3).

---

## 1. Context

Phase 1 (auth, groups, invitations, gated shell) is done and merged (`main`,
`79a73c2`). Every product screen still renders from `src/data/mock/`:
`MOCK_KNOWLEDGE` (11 items: 5 vocabulary, 3 grammar, 1 reading, 1 file, 1 note)
backs Today, Library, Knowledge detail, and practice/exam question generation.
The Add flow (`AddKnowledgeView`) is fully built — manual form + a simulated
AI-structuring step — but nothing it submits persists; a valid submit just shows
a confirmation panel.

Follow-on phases (not designed here):

- **Phase 3** — personal-data persistence (practice/exam results, review marks —
  currently `localStorage` / in-memory).
- **A file-upload follow-up** — real Supabase Storage upload for `FileItem`,
  deliberately deferred out of this phase (see §10).
- **AI phase** (`src/ai/`) — untouched. `getAiSuggestion` /
  `getAiSuggestionFromAttachment` keep simulating the structuring step.

## 2. Decisions locked before design

| Decision | Choice | Rationale |
| --- | --- | --- |
| Data model | **Single `knowledge_items` table**, nullable per-type columns, `type` discriminator | Today/Library/search/practice all need mixed-type lists as the primary access pattern; a base + per-type-child-table design forces a join on every hot path for no benefit at this data volume. |
| Type-specific field integrity | **CHECK constraints per type** (e.g. vocabulary requires `term`/`meaning`/`part_of_speech` not null) | Defense-in-depth under service-layer + zod validation, same spirit as Phase 1's RLS-as-net-under-service-layer stance. |
| Reading → vocabulary links | Plain nullable `uuid[]` column, no join table | No linking UI exists in the Add flow; this is display-only today, populated only by the seed. A join table is unjustified normalization for a field nothing writes yet. |
| Search | **Multi-column `ILIKE`** (OR'd across the type-relevant text columns) | Direct SQL equivalent of today's `JSON.stringify().includes()` scan. A `tsvector`/GIN approach scales better and fits the AI/embeddings roadmap, but is unjustified setup for a private study group's item count — noted as a clean future upgrade, not built now. |
| Add flow scope | **All four authorable types persist for real** (vocabulary, grammar, reading, note) | Manual entry and a confirmed AI suggestion both go through the same real `createKnowledgeItem` path; only the AI *structuring* step stays simulated. |
| Files | **Deferred** — `FileItem` stays mocked, `url` stays `null` | Keeps this phase focused on the library core; Storage wiring is a self-contained follow-up. |
| Demo content | **Seed the 11 existing mock items** into the seeded group, idempotently | Otherwise Today/Library are blank in dev and on the first preview deploy right after this ships. |
| Group scoping | Every table, query, and RLS policy scoped by `group_id`, same actor-resolves-itself pattern as `group-service.ts` | Direct extension of Phase 1's multi-group tenancy; no new tenancy decision to make. |

## 3. Architecture & layering

Same request flow as Phase 1 (`server/README.md`), extended with one more
vertical slice:

```
Browser
 -> Server Component (Today, Library, Knowledge detail, layout stats)
     -> server/services/knowledge-service.ts   (direct call, like group-service.ts)
 -> Server Action (Add submit, Practice/Exam generation, review-list resolution)
     -> server/actions/knowledge.ts            (zod validation, ActionResult<T>)
         -> server/services/knowledge-service.ts / practice-service.ts
             -> server/repositories/knowledge.ts
                 -> server/db/client.ts
```

### Why new Server Actions are required

Three existing consumers are client components (`"use client"`) that currently
import mock functions directly — not allowed against `server/` per the Phase 1
invariant ("client components never import from `src/server/`"):

| Client component | Current call | New action |
| --- | --- | --- |
| `features/add/add-knowledge-view.tsx` | (submits with nothing persisted) | `createKnowledgeItem` |
| `features/practice/practice-view.tsx` | `getPracticeQuestions` | `generatePracticeQuestions` |
| `features/exam/exam-view.tsx` | `getExamQuestions` | `generateExamQuestions` |
| `features/profile/review-list-section.tsx` | `getKnowledgeByIds` | `resolveKnowledgeByIds` |

Server Components keep calling services directly, same as Phase 1
(`today/page.tsx`, `library/page.tsx`, `knowledge/[id]/page.tsx`,
`(app)/layout.tsx`, `profile/page.tsx`, `exam/page.tsx`, `practice/page.tsx` for
`getLibraryFacets`/`getLibraryStats`/`getTodayFeed`/`getKnowledgeById`).
`features/knowledge/knowledge-detail-view.tsx` (reading → vocabulary link
resolution) is a Server Component today and stays one — no action needed there.

### `server/` modules added in Phase 2

| Module | Responsibility |
| --- | --- |
| `db/schema.ts` (extended) | `knowledge_items` table, `knowledge_type` / `knowledge_source` / `dutch_article` enums |
| `db/migrations/0002_knowledge_items` | enums, table, indexes, CHECK constraints (generated) |
| `db/migrations/0003_knowledge_rls` | RLS enable + policies (hand-written, mirrors `0001`) |
| `db/seed.ts` (extended) | idempotently inserts the 11 former mock items for the seeded group, all attributed to the seed owner |
| `errors.ts` | reused as-is (`ValidationError`, `ForbiddenError`, `NotFoundError`) |
| `repositories/knowledge.ts` | `insertKnowledgeItem`, `listKnowledgeItems`, `getKnowledgeItemById`, `getKnowledgeItemsByIds`, `getKnowledgeStats`, `getKnowledgeFacets` — all group-scoped, no authorization logic |
| `services/knowledge-service.ts` | `createKnowledgeItem`, `getTodayFeed`, `getLibraryItems`, `getLibraryFacets`, `getLibraryStats`, `getKnowledgeById`, `getKnowledgeByIds` — resolve actor + active group via `resolveActiveContext()` themselves |
| `services/practice-service.ts` | `generatePracticeQuestions`, `generateExamQuestions` — the existing deterministic algorithm, group-scoped data source |
| `actions/knowledge.ts` | `createKnowledgeItem`, `generatePracticeQuestions`, `generateExamQuestions`, `resolveKnowledgeByIds` — zod validation, `ActionResult<T>`, `toActionError` |
| `actions/schemas.ts` (extended) | `createKnowledgeItemSchema` (discriminated union on `type`), `practiceSetupSchema`, `knowledgeIdsSchema` |

## 4. Data model

### Enums

- `knowledge_type` = `('vocabulary', 'grammar', 'reading', 'note')` — `file` is
  intentionally **not** in this enum; no row can be created with it until the
  file-upload follow-up.
- `knowledge_source` = `('manual', 'photo', 'file-upload', 'ai-assisted')`
  (unchanged shape from `KnowledgeSource`).
- `dutch_article` = `('de', 'het')`.

`cefr_level` was considered as an enum for `level`, but the column stays
nullable `text` with an app-level `CHECK (level IS NULL OR level IN ('A1', 'A2',
'B1', 'B2', 'C1', 'C2'))` — avoids a second enum type change every time
`CEFR_LEVELS` (`src/types/cefr.ts`) is touched; the constraint gives the same
safety.

### `knowledge_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `group_id` | `uuid` not null | references `groups(id)` on delete cascade |
| `type` | `knowledge_type` not null | |
| `level` | `text` | nullable, CHECK per above |
| `tags` | `text[]` not null default `'{}'` | |
| `source` | `knowledge_source` not null | |
| `added_by` | `uuid` not null | references `auth.users(id)` |
| `created_at` | `timestamptz` not null default `now()` | |
| `updated_at` | `timestamptz` not null default `now()` | |
| `term` | `text` | vocabulary |
| `meaning` | `text` | vocabulary |
| `part_of_speech` | `text` | vocabulary |
| `example` | `text` | vocabulary |
| `example_translation` | `text` | vocabulary |
| `article` | `dutch_article` | vocabulary |
| `plural` | `text` | vocabulary |
| `past_tense` | `text` | vocabulary |
| `perfect` | `text` | vocabulary |
| `usage_note` | `text` | vocabulary |
| `title` | `text` | grammar (required) / reading (required) / note (optional) |
| `summary` | `text` | grammar (required) / reading (optional) |
| `explanation` | `text` | grammar (required) |
| `examples` | `jsonb` | grammar; array of `{ nl, en }` |
| `body` | `text` | reading (required) / note (required) |
| `word_count` | `integer` | reading; computed by the service from `body` at create time |
| `vocabulary_ids` | `uuid[]` | reading; nullable, display-only (see §2) |

CHECK constraints (one per type, all `type <> '<type>' OR (...)`):

- `vocabulary`: `term`, `meaning`, `part_of_speech` not null.
- `grammar`: `title`, `summary`, `explanation` not null.
- `reading`: `title`, `body` not null.
- `note`: `body` not null.

Indexes: `group_id` (every query filters on it), `(group_id, type)` (facet /
Today grouping), `added_by`. No index backs the `ILIKE` search — sequential
scan is fine at this scale; see §2 for the upgrade path if it stops being fine.

### RLS

Same stance as Phase 1 — service layer is primary, RLS is the net:

- `select` — caller is a member of `group_id`.
- `insert` — caller is a member of `group_id` (any role; unlike invitations,
  adding library content is not owner-only).
- No `update` / `delete` policy — nothing in the product can edit or delete a
  knowledge item yet (§10).

### Seed (`server/db/seed.ts`, extended)

After the existing owner + group upsert: if the seeded group currently has zero
`knowledge_items` rows, insert the 11 items from today's `MOCK_KNOWLEDGE`
(minus the one `file` item, which the new type enum can't represent — 10 items:
5 vocabulary, 3 grammar, 1 reading, 1 note), all attributed to the seed owner
(the mock's multi-author attribution — Sofie/Omar/Lena — can't be reproduced
without fabricating extra auth users, which is out of scope). Idempotent by the
zero-rows check; safe to re-run like the rest of the seed.

## 5. Read path

`server/repositories/knowledge.ts` exposes one filtering primitive,
`listKnowledgeItems(groupId, { type?, level?, addedBy?, search?, sort?, ids?
})`, that every read in `knowledge-service.ts` and `practice-service.ts`
composes:

- `getTodayFeed()` → `listKnowledgeItems(groupId, {})`, filtered client-side in
  the service to rows created on the real calendar day (`new Date()` — replaces
  the fixed `MOCK_TODAY`), same grouping into vocabulary/grammar/textsAndFiles
  as today.
- `getLibraryItems(query, page)` → `listKnowledgeItems` with `type`/`level`/
  `addedBy`/`search`, sorted, paginated (`PAGE_SIZE = 12`, unchanged).
- `getLibraryFacets()` → distinct `level` values present + group members (the
  latter already comes from `listMembers`, Phase 1).
- `getLibraryStats()` → `getKnowledgeStats(groupId)`, a `group by type, count(*)`.
- `getKnowledgeById(id)` / `getKnowledgeByIds(ids)` → group-scoped lookups;
  `NotFoundError` (service) if the id exists but belongs to another group —
  same "don't leak existence across groups" posture as Phase 1's invitations.
- `practice-service.ts`'s scope filter (`today` / `level` / `review` /
  `custom`) and its distractor pools (`allMeanings`, `allTerms`, `allTitles`)
  **all** query `listKnowledgeItems(groupId, ...)` — every pool is group-scoped,
  never global. Getting this wrong would leak one group's vocabulary into
  another group's multiple-choice distractors.

The generation algorithm itself (stable hashing for deterministic option order
and question shuffling) is unchanged — only its data source moves.

## 6. Write path

`createKnowledgeItem(input)` in `knowledge-service.ts`:

1. `resolveActiveContext()` for the actor + active group (same self-healing
   pattern `getGroupSettings()` uses — never trusts the cookie alone).
2. Input already validated by the zod discriminated union in the Server Action
   layer (`createKnowledgeItemSchema`, matching each `AuthableType`'s `REQUIRED`
   fields from `features/add/types.ts`).
3. For `type: "reading"`, compute `word_count` from the submitted body
   (same split-on-whitespace logic `ReadingFields` already uses for the live
   counter).
4. `insertKnowledgeItem(groupId, actor, fields)` — single insert, `source`
   comes from the caller (`"manual"` for the plain form, `"ai-assisted"` for a
   confirmed AI suggestion, `"photo"` / `"file-upload"` when the AI path started
   from an attachment).
5. Returns the shaped `KnowledgeItem` so `AddKnowledgeView` can show the
   existing `SuccessPanel` with the real title.

`AddKnowledgeView.handleSubmit` becomes async: on `ActionResult` failure, the
existing error-per-field UI stays for validation errors; a generic failure
(network/DB) surfaces a new `add.errors.generic` message near the submit
button, mirroring `group.settings.errors.generic` from Phase 1.

## 7. Frontend integration & i18n

### Changed files

| Path | Change |
| --- | --- |
| `src/data/mock/knowledge.ts` | deleted |
| `src/data/mock/index.ts` | knowledge/today/library/practice/exam functions removed; `getAiSuggestion*` stay |
| `src/features/add/add-knowledge-view.tsx` | `handleSubmit` calls `createKnowledgeItem` action, awaits, handles `ActionResult` |
| `src/features/practice/practice-view.tsx`, `src/features/exam/exam-view.tsx` | call `generatePracticeQuestions` / `generateExamQuestions` actions instead of the mock import |
| `src/features/profile/review-list-section.tsx` | calls `resolveKnowledgeByIds` action |
| `src/app/(app)/today/page.tsx`, `library/page.tsx`, `knowledge/[id]/page.tsx`, `(app)/layout.tsx`, `profile/page.tsx`, `practice/page.tsx`, `exam/page.tsx` | repoint imports from `@/data/mock` to `@/server/services/knowledge-service` |
| `.env.example` | no new variables — reuses Phase 1's Supabase/Drizzle vars |

### i18n

One new key pair (NL + EN, key parity): `add.errors.generic` — generic save
failure message next to the Add form's submit button. No other new
user-facing strings; all existing Add/Library/Today/Practice/Exam copy is
unchanged, it's just backed by real data now.

## 8. Dependencies, migrations, testing

No new runtime or dev dependencies — everything needed (`drizzle-orm`,
`postgres`, `zod`, `vitest`) is already in place from Phase 1.

### Migrations

- `0002_knowledge_items` — enums, `knowledge_items` table, indexes, CHECK
  constraints (generated via `drizzle-kit generate`).
- `0003_knowledge_rls` — `enable row level security` + the two policies from
  §4 (hand-written, same pattern as `0001`).

### Testing

- **Unit (no DB):**
  - `createKnowledgeItemSchema` — accept/reject fixtures per type (missing
    required field, wrong discriminant, malformed uuid).
  - `createKnowledgeItem` authorization — no active group → error; word-count
    computation for readings.
  - `practice-service` — port the existing deterministic-algorithm tests
    (option shuffling, distractor pool composition) against a repository
    stub instead of `MOCK_KNOWLEDGE`; add a case proving cross-group data
    never appears in another group's pools.
  - `listKnowledgeItems` filter composition (type/level/search/addedBy/sort)
    against a repository-level fixture.
- **Integration (real DB, gated on `TEST_DATABASE_URL`, skipped when unset):**
  - create → appears in `getLibraryItems` / `getTodayFeed` (if created today) /
    `getKnowledgeById`.
  - RLS smoke — an anon-key `select` on `knowledge_items` returns only rows for
    the caller's groups; a non-member `insert` is rejected.
  - Seed idempotency — running `db:seed` twice does not duplicate the 10 rows.
- **Manual review checklist** (ships with the implementation plan, mirroring
  Phase 1 §9): add one item of each of the 4 types, confirm it appears on
  Today (if added today) and Library; run a Practice and an Exam session
  against real data; confirm a second group's practice session never surfaces
  the first group's vocabulary as a distractor; NL/EN check on the one new
  string.
- Existing gates stay green: `npm run typecheck && npm run lint && npm run
  build && npm test`.

## 9. Verification

### Order of work

1. Schema + migrations against the dev Supabase project; eyeball with
   `drizzle-kit studio`.
2. Seed extension — confirm the 10 items land once, re-running the seed adds
   nothing.
3. Read path — repoint Today/Library/Knowledge-detail/layout stats to the
   service layer; confirm existing screens render identically against real
   data.
4. Write path — Add flow submits for real, all 4 types, both the plain-form
   and AI-confirm paths.
5. Practice/Exam — new Server Actions, confirm generation still works and stays
   group-scoped with two seeded groups (temporary second seed group for this
   check only, not kept).
6. Full manual checklist, NL and EN.
7. Deploy to a Vercel preview; re-run the checklist there.

## 10. Out of scope for Phase 2

- File upload / Supabase Storage — `FileItem` stays mocked; a focused
  follow-up once the core library is proven.
- Editing or deleting a knowledge item — no UI exists for either; nothing in
  this phase adds one.
- Reading → vocabulary link authoring — `vocabulary_ids` is populated only by
  the seed; no Add-flow UI creates these links.
- `tsvector`/full-text or trigram search — plain `ILIKE` for now (§2).
- Practice/exam **result** persistence, review marks — Phase 3.
- Tag-based filtering in the Library UI — `tags` persists but no filter control
  reads it yet (matches current mock behavior).
- `src/ai/` — untouched.
