# Knowledge Item Edit & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a knowledge item's author, or the group owner, edit or soft-delete it. Everyone else stays view-only.

**Architecture:** One new RLS `UPDATE` policy (delete is just a special update — `deleted_at`) reusing the `is_group_member`/`is_group_owner` helper functions from `0004_fix_recursive_rls.sql`. Same layering as the rest of the backend: repository (raw queries, `deleted_at IS NULL` on every read) → service (`resolveActiveContext()` + author-or-owner authorization) → actions (zod + `ActionResult`) → the existing Add form, extended to double as an Edit form.

**Tech Stack:** Next.js 16, TypeScript strict, Drizzle ORM, zod, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-knowledge-item-edit-delete-design.md` — read it alongside this plan.

## Global Constraints

- Gates stay green after every task: `npm test && npm run typecheck && npm run lint && npm run build`.
- TypeScript strict. No `any`. No unsafe `!` outside the pattern already established in `mapRow` (a value the DB CHECK constraint guarantees non-null for that branch).
- Every user-facing string is i18n'd — identical key trees in `src/messages/nl.json` and `en.json`.
- Client components never import from `src/server/` except `import type` (already-established, reviewed pattern from Phase 2).
- Services resolve the actor + active group + role themselves via `resolveActiveContext()` — never trust a caller-supplied id as a trust boundary.
- **`TEST_DATABASE_URL` is unset in `.env.local`.** If a task needs to run the new/extended RLS integration test against the real dev database, set it temporarily for that one `npx vitest run <file>` command, confirm the result, then **unset it again immediately** — do not run bare `npm test` while it's set (the *other* integration test files `TRUNCATE` on every run and would wipe live data).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WGXYNWR2yrBy9LN8Hm7fvD
  ```

---

## File Structure

**New:**

| Path | Responsibility |
| --- | --- |
| `src/server/db/migrations/0005_*.sql` | generated — `deleted_at`, `updated_by` columns |
| `src/server/db/migrations/0006_knowledge_update_rls.sql` | hand-written — the one new `UPDATE` policy |
| `src/app/(app)/knowledge/[id]/edit/page.tsx` | edit route — Server Component, redirects non-author/non-owner before rendering |

**Modified:**

| Path | Change |
| --- | --- |
| `src/server/db/schema.ts` | `knowledgeItems`: add `deletedAt`, `updatedBy` columns |
| `src/server/db/schema.test.ts` | assert the two new columns |
| `src/types/knowledge.ts` | `KnowledgeItemBase` gains `updatedBy: UserSummary \| null` |
| `src/server/repositories/knowledge.ts` | `deleted_at IS NULL` on every read; double-join for `updatedBy`; `updateKnowledgeItem`, `softDeleteKnowledgeItem` |
| `src/server/repositories/knowledge.integration.test.ts` | extend for the new columns/filter |
| `src/server/services/knowledge-service.ts` | `requireActiveGroupId()` also returns `role`; `updateKnowledgeItem`, `deleteKnowledgeItem` |
| `src/server/services/knowledge-service.test.ts` | authorization matrix tests |
| `src/server/actions/schemas.ts` | `knowledgeItemIdSchema` |
| `src/server/actions/knowledge.ts` | `updateKnowledgeItemAction`, `deleteKnowledgeItemAction` |
| `src/features/add/types.ts` | `itemToValues()` (reverse of `buildCreateInput`) |
| `src/features/add/add-knowledge-view.tsx` | `existingItem?: KnowledgeItem` prop → edit mode |
| `src/features/add/knowledge-form.tsx` | `typeLocked?: boolean` — hides the `TypePicker` in edit mode |
| `src/features/knowledge/knowledge-actions.tsx` | Edit link + Delete button, shown only to author/owner |
| `src/features/knowledge/knowledge-detail-view.tsx` | pass `item`/permission data to `KnowledgeActions`; "Edited by X" note |
| `src/server/repositories/rls.integration.test.ts` | extend: author/owner can update, other member cannot |
| `src/messages/nl.json`, `en.json` | new keys, listed per-task |

---

## Task 1: Schema, migrations, types

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/schema.test.ts`
- Modify: `src/types/knowledge.ts`
- Create: `src/server/db/migrations/0005_*.sql` (generated)
- Create: `src/server/db/migrations/0006_knowledge_update_rls.sql` (hand-written)

**Interfaces:**
- Consumes: `knowledgeItems` table, `is_group_member`/`is_group_owner` SQL functions (already exist from `0004_fix_recursive_rls.sql`).
- Produces: `knowledgeItems.deletedAt` (`timestamptz`, nullable), `knowledgeItems.updatedBy` (`uuid`, nullable, references `auth.users(id)`); `KnowledgeItemBase.updatedBy: UserSummary | null`.

- [ ] **Step 1: Write the failing test**

Append to `src/server/db/schema.test.ts` (keep the existing `describe` blocks):

```ts
describe("knowledgeItems edit/delete columns", () => {
  it("has deletedAt and updatedBy", () => {
    const cols = getTableConfig(knowledgeItems).columns.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["deleted_at", "updated_by"]));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/db/schema.test.ts`
Expected: FAIL — `deleted_at`/`updated_by` not in the column list.

- [ ] **Step 3: Extend `src/server/db/schema.ts`**

Inside the `knowledgeItems` column object, right after `updatedAt`:

```ts
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Soft delete: NULL = active. Set once on delete; never cleared (no
    // restore UI yet). Who last edited the row (NULL until the first edit).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => authUsers.id),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `src/types/knowledge.ts`**

In `KnowledgeItemBase`, right after `addedBy`:

```ts
  /** Person who added it — shared library shows attribution. */
  addedBy: UserSummary;
  /** Person who last edited it, or null if never edited. */
  updatedBy: UserSummary | null;
```

- [ ] **Step 6: Generate migration 0005**

Run: `npm run db:generate`
Expected: creates `src/server/db/migrations/0005_<name>.sql`. Open it and confirm it's exactly two `ALTER TABLE "knowledge_items" ADD COLUMN "deleted_at" timestamp with time zone` / `ADD COLUMN "updated_by" uuid` (plus the FK constraint) — nothing else.

- [ ] **Step 7: Hand-write `src/server/db/migrations/0006_knowledge_update_rls.sql`**

```sql
-- Author-or-owner can edit or soft-delete a knowledge item. Delete is just a
-- special update (sets deleted_at), so one UPDATE policy covers both —
-- reuses the is_group_member/is_group_owner helpers from
-- 0004_fix_recursive_rls.sql, so there's no new recursion risk.
CREATE POLICY "knowledge_items_update_author_or_owner" ON "knowledge_items"
  FOR UPDATE TO authenticated
  USING (is_group_member(group_id) AND (added_by = auth.uid() OR is_group_owner(group_id)))
  WITH CHECK (is_group_member(group_id) AND (added_by = auth.uid() OR is_group_owner(group_id)));
```

- [ ] **Step 8: Register the hand-written migration in the journal**

In `src/server/db/migrations/meta/_journal.json`, append an entry after the `0005` one drizzle-kit generated: `"idx": 6`, `"tag": "0006_knowledge_update_rls"`, a new `"when"` (`Date.now()`), same `"version"`. (If `0005` came in as idx 5, this is idx 6 — check the file after Step 6 to confirm the actual idx drizzle-kit assigned before adding yours.)

- [ ] **Step 9: Apply both migrations to the dev database**

Run: `npm run db:migrate`
Expected: both apply cleanly. In the Supabase dashboard, confirm the two new columns exist and the new policy is listed under `knowledge_items`'s policies.

- [ ] **Step 10: Gates + commit**

```bash
npm test && npm run typecheck && npm run lint && npm run build
git add src/server/db/schema.ts src/server/db/schema.test.ts src/types/knowledge.ts src/server/db/migrations/
git commit -m "feat(db): deleted_at/updated_by columns + author-or-owner UPDATE policy"
```

---

## Task 2: Repository — update, soft-delete, deleted_at filtering

**Files:**
- Modify: `src/server/repositories/knowledge.ts`
- Modify: `src/server/repositories/knowledge.integration.test.ts`

**Interfaces:**
- Consumes: `deletedAt`, `updatedBy` columns (Task 1); `Db` (`@/server/db/client`).
- Produces:
  - `updateKnowledgeItem(tx: Db, groupId: string, id: string, updatedBy: string, fields: Partial<NewKnowledgeItemRow>): Promise<KnowledgeItem | null>` — `null` if no matching non-deleted row in that group.
  - `softDeleteKnowledgeItem(groupId: string, id: string): Promise<boolean>` — `true` if a row was deleted.
  - `listKnowledgeItems` / `getKnowledgeItemById` — now always exclude soft-deleted rows.
  - `mapRow` — new third parameter `updatedBy: UserSummary | null`.

- [ ] **Step 1: Write the failing integration test**

Append to `src/server/repositories/knowledge.integration.test.ts` (inside the existing `run(...)` block, alongside the existing `it`s):

```ts
  it("excludes soft-deleted rows and supports update", async () => {
    const group = await makeGroup("G5");
    const created = await repo.insertKnowledgeItem(testDb!, {
      groupId: group.id,
      type: "note",
      level: null,
      tags: [],
      source: "manual",
      addedBy: owner,
      title: null,
      body: "original",
    });
    expect(created.updatedBy).toBeNull();

    const updated = await repo.updateKnowledgeItem(testDb!, group.id, created.id, owner, {
      body: "edited",
    });
    expect(updated).toMatchObject({ id: created.id, updatedBy: { id: owner } });
    expect((updated as { body: string }).body).toBe("edited");

    const deletedOk = await repo.softDeleteKnowledgeItem(group.id, created.id);
    expect(deletedOk).toBe(true);

    expect(await repo.getKnowledgeItemById(group.id, created.id)).toBeNull();
    expect(await repo.listKnowledgeItems(group.id)).toHaveLength(0);

    // Deleting again (already gone) reports no row affected.
    expect(await repo.softDeleteKnowledgeItem(group.id, created.id)).toBe(false);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `TEST_DATABASE_URL=<your test db> npx vitest run src/server/repositories/knowledge.integration.test.ts`
Expected: FAIL — `repo.updateKnowledgeItem` is not a function.

- [ ] **Step 3: Extend `src/server/repositories/knowledge.ts`**

Add `isNull` to the `drizzle-orm` import and `alias` from `drizzle-orm/pg-core`:

```ts
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
```

Add, right after the `SEARCH_COLUMNS` constant:

```ts
const updatedByProfiles = alias(profiles, "updated_by_profiles");
```

Replace `mapRow`'s signature and `base` object:

```ts
function mapRow(
  row: KnowledgeItemRow,
  addedBy: UserSummary,
  updatedBy: UserSummary | null,
): KnowledgeItem {
  const base = {
    id: row.id,
    level: row.level as CEFRLevel | null,
    tags: row.tags,
    source: row.source,
    addedBy,
    updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
```

(Every `return { ...base, type: ... }` branch below is unchanged — `updatedBy` flows through via the spread.)

Replace `buildFilter` to exclude soft-deleted rows:

```ts
function buildFilter(groupId: string, filter: KnowledgeListFilter = {}) {
  const clauses = [eq(knowledgeItems.groupId, groupId), isNull(knowledgeItems.deletedAt)];
```

(the rest of `buildFilter`'s body is unchanged.)

Replace `selectWithAttribution` to also left-join the editor's profile and accept an optional executor (so it can run inside a caller's transaction):

```ts
async function selectWithAttribution(
  where: ReturnType<typeof and>,
  executor: Db = db,
): Promise<KnowledgeItem[]> {
  const rows = await executor
    .select({
      item: knowledgeItems,
      profile: {
        id: profiles.id,
        displayName: profiles.displayName,
        initials: profiles.initials,
        accent: profiles.accent,
      },
      updatedByProfile: {
        id: updatedByProfiles.id,
        displayName: updatedByProfiles.displayName,
        initials: updatedByProfiles.initials,
        accent: updatedByProfiles.accent,
      },
    })
    .from(knowledgeItems)
    .innerJoin(profiles, eq(profiles.id, knowledgeItems.addedBy))
    .leftJoin(updatedByProfiles, eq(updatedByProfiles.id, knowledgeItems.updatedBy))
    .where(where);

  return rows.map(({ item, profile, updatedByProfile }) =>
    mapRow(item, toUserSummary(profile), updatedByProfile ? toUserSummary(updatedByProfile) : null),
  );
}
```

Update `getKnowledgeItemById`'s `where` to also exclude soft-deleted rows:

```ts
export async function getKnowledgeItemById(
  groupId: string,
  id: string,
): Promise<KnowledgeItem | null> {
  if (!isUuid(id)) return null;
  const items = await selectWithAttribution(
    and(eq(knowledgeItems.groupId, groupId), eq(knowledgeItems.id, id), isNull(knowledgeItems.deletedAt)),
  );
  return items[0] ?? null;
}
```

Update `insertKnowledgeItem`'s final line (it manually builds a `KnowledgeItem`, not via `selectWithAttribution`, so it needs the new third `mapRow` argument explicitly):

```ts
  return mapRow(inserted, toUserSummary(profile), null);
```

Add, after `insertKnowledgeItem`:

```ts
export async function updateKnowledgeItem(
  tx: Db,
  groupId: string,
  id: string,
  updatedBy: string,
  fields: Partial<NewKnowledgeItemRow>,
): Promise<KnowledgeItem | null> {
  const [updated] = await tx
    .update(knowledgeItems)
    .set({ ...fields, updatedBy, updatedAt: new Date() })
    .where(
      and(
        eq(knowledgeItems.id, id),
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .returning({ id: knowledgeItems.id });
  if (!updated) return null;
  const items = await selectWithAttribution(eq(knowledgeItems.id, updated.id), tx);
  return items[0] ?? null;
}

export async function softDeleteKnowledgeItem(groupId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .update(knowledgeItems)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(knowledgeItems.id, id),
        eq(knowledgeItems.groupId, groupId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .returning({ id: knowledgeItems.id });
  return !!deleted;
}
```

(`softDeleteKnowledgeItem` doesn't take a `tx` — it's a single statement with nothing to read back, matching the existing tx-less style of `markRevoked` in `repositories/invitations.ts`. `updateKnowledgeItem` needs `tx` because it does a follow-up `SELECT` that must see its own uncommitted `UPDATE`.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `TEST_DATABASE_URL=<your test db> npx vitest run src/server/repositories/knowledge.integration.test.ts`
Expected: PASS — 4 passed (3 existing + 1 new).

- [ ] **Step 5: Gates**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Unset `TEST_DATABASE_URL`, commit**

```bash
git add src/server/repositories/knowledge.ts src/server/repositories/knowledge.integration.test.ts
git commit -m "feat(server): knowledge_items update/soft-delete, exclude deleted rows"
```

---

## Task 3: Service — authorization, update, delete

**Files:**
- Modify: `src/server/services/knowledge-service.ts`
- Modify: `src/server/services/knowledge-service.test.ts`

**Interfaces:**
- Consumes: `updateKnowledgeItem`, `softDeleteKnowledgeItem` (`@/server/repositories/knowledge`, Task 2); `ValidationError`, `ForbiddenError`, `NotFoundError` (`@/server/errors`); `GroupRole` (`@/types`).
- Produces:
  - `requireActiveGroupId()` — now returns `{ groupId: string; userId: string; role: GroupRole }` (backward compatible — every existing call site destructures a subset).
  - `updateKnowledgeItem(id: string, input: CreateKnowledgeItemInput): Promise<KnowledgeItem>`
  - `deleteKnowledgeItem(id: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Append to `src/server/services/knowledge-service.test.ts` (reuse the file's existing `vi.mock`s for `@/server/repositories/knowledge`, `@/server/db/client`, `@/server/services/session-service`; add the two new repo mocks to the existing `vi.mock("@/server/repositories/knowledge", ...)` factory — `updateKnowledgeItem: vi.fn()` and `softDeleteKnowledgeItem: vi.fn()`):

```ts
import * as repo from "@/server/repositories/knowledge"; // already imported in this file
import { ForbiddenError, ValidationError } from "@/server/errors"; // add ValidationError to the existing import
import { updateKnowledgeItem, deleteKnowledgeItem } from "./knowledge-service"; // add to the existing import

const okCtxWithRole = (role: "owner" | "member") => ({
  status: "ok" as const,
  user,
  activeGroup: { id: "g1", name: "G", slug: "g" },
  membership: { groupId: "g1", userId: "u1", role },
});

describe("updateKnowledgeItem", () => {
  it("rejects a non-author, non-owner member", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: { ...user, id: "someone-else" } }),
    );
    await expect(
      updateKnowledgeItem("k1", {
        type: "vocabulary",
        level: null,
        tags: [],
        source: "manual",
        term: "x",
        meaning: "y",
        partOfSpeech: "z",
        example: null,
        exampleTranslation: null,
        article: null,
        plural: null,
        pastTense: null,
        perfect: null,
        usageNote: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows the author", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(vocab({ id: "k1", addedBy: user }));
    vi.mocked(repo.updateKnowledgeItem).mockResolvedValue(vocab({ id: "k1" }));
    const result = await updateKnowledgeItem("k1", {
      type: "vocabulary",
      level: null,
      tags: [],
      source: "manual",
      term: "x",
      meaning: "y",
      partOfSpeech: "z",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    expect(result.id).toBe("k1");
  });

  it("allows the owner even if not the author", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("owner"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: { ...user, id: "someone-else" } }),
    );
    vi.mocked(repo.updateKnowledgeItem).mockResolvedValue(vocab({ id: "k1" }));
    const result = await updateKnowledgeItem("k1", {
      type: "vocabulary",
      level: null,
      tags: [],
      source: "manual",
      term: "x",
      meaning: "y",
      partOfSpeech: "z",
      example: null,
      exampleTranslation: null,
      article: null,
      plural: null,
      pastTense: null,
      perfect: null,
      usageNote: null,
    });
    expect(result.id).toBe("k1");
  });

  it("rejects switching an item's type", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(vocab({ id: "k1", addedBy: user, type: "note" as never }));
    await expect(
      updateKnowledgeItem("k1", {
        type: "vocabulary",
        level: null,
        tags: [],
        source: "manual",
        term: "x",
        meaning: "y",
        partOfSpeech: "z",
        example: null,
        exampleTranslation: null,
        article: null,
        plural: null,
        pastTense: null,
        perfect: null,
        usageNote: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("deleteKnowledgeItem", () => {
  it("rejects a non-author, non-owner member", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(
      vocab({ id: "k1", addedBy: { ...user, id: "someone-else" } }),
    );
    await expect(deleteKnowledgeItem("k1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows the author and calls softDeleteKnowledgeItem", async () => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtxWithRole("member"));
    vi.mocked(repo.getKnowledgeItemById).mockResolvedValue(vocab({ id: "k1", addedBy: user }));
    vi.mocked(repo.softDeleteKnowledgeItem).mockResolvedValue(true);
    await deleteKnowledgeItem("k1");
    expect(repo.softDeleteKnowledgeItem).toHaveBeenCalledWith("g1", "k1");
  });
});
```

(This file already defines a `vocab(over)` fixture helper and a shared `user` const from Task 4 of the earlier backend-phase-2 plan — reuse them; `vocab({ addedBy: {...} })` overrides the default `addedBy: user`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/services/knowledge-service.test.ts`
Expected: FAIL — `updateKnowledgeItem`/`deleteKnowledgeItem` not exported from `./knowledge-service`.

- [ ] **Step 3: Extend `src/server/services/knowledge-service.ts`**

Change the imports: alias the repository's `updateKnowledgeItem` to avoid colliding with this file's own export of the same name, add `softDeleteKnowledgeItem`, add `ValidationError`/`ForbiddenError`, add `GroupRole`:

```ts
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import {
  getDistinctLevels,
  getKnowledgeItemById,
  getKnowledgeStats,
  insertKnowledgeItem,
  listKnowledgeItems,
  softDeleteKnowledgeItem,
  updateKnowledgeItem as updateKnowledgeItemRow,
} from "@/server/repositories/knowledge";
import { listMembers } from "@/server/repositories/memberships";
import { resolveActiveContext } from "@/server/services/session-service";
import type {
  CEFRLevel,
  GrammarItem,
  GroupMemberSummary,
  GroupRole,
  KnowledgeItem,
  KnowledgeType,
  ReadingItem,
  VocabularyItem,
} from "@/types";
```

Replace `requireActiveGroupId`:

```ts
async function requireActiveGroupId(): Promise<{ groupId: string; userId: string; role: GroupRole }> {
  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") throw new NotFoundError("No active group");
  return { groupId: ctx.activeGroup.id, userId: ctx.user.id, role: ctx.membership.role };
}

function assertCanModify(item: KnowledgeItem, userId: string, role: GroupRole): void {
  if (item.addedBy.id !== userId && role !== "owner") {
    throw new ForbiddenError("Only the author or the group owner can edit or delete this item");
  }
}
```

Add, after `createKnowledgeItem`:

```ts
export async function updateKnowledgeItem(
  id: string,
  input: CreateKnowledgeItemInput,
): Promise<KnowledgeItem> {
  const { groupId, userId, role } = await requireActiveGroupId();
  const existing = await getKnowledgeItemById(groupId, id);
  if (!existing) throw new NotFoundError("Knowledge item not found");
  assertCanModify(existing, userId, role);
  if (input.type !== existing.type) {
    throw new ValidationError("Changing a knowledge item's type is not supported");
  }

  const shared = { level: input.level, tags: input.tags, source: input.source };

  const updated = await db.transaction((tx) => {
    const dbtx = tx as unknown as Db;
    switch (input.type) {
      case "vocabulary":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, { ...shared, ...input, type: "vocabulary" });
      case "grammar":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, { ...shared, ...input, type: "grammar" });
      case "reading":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, {
          ...shared,
          ...input,
          type: "reading",
          wordCount: wordCount(input.body),
        });
      case "note":
        return updateKnowledgeItemRow(dbtx, groupId, id, userId, { ...shared, ...input, type: "note" });
    }
  });
  if (!updated) throw new NotFoundError("Knowledge item not found");
  return updated;
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  const { groupId, userId, role } = await requireActiveGroupId();
  const existing = await getKnowledgeItemById(groupId, id);
  if (!existing) throw new NotFoundError("Knowledge item not found");
  assertCanModify(existing, userId, role);
  await softDeleteKnowledgeItem(groupId, id);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/services/knowledge-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
npm test && npm run typecheck && npm run lint && npm run build
git add src/server/services/knowledge-service.ts src/server/services/knowledge-service.test.ts
git commit -m "feat(server): author-or-owner authorization for update/delete"
```

---

## Task 4: Zod schema + Server Actions

**Files:**
- Modify: `src/server/actions/schemas.ts`
- Modify: `src/server/actions/schemas.test.ts`
- Modify: `src/server/actions/knowledge.ts`

**Interfaces:**
- Consumes: `updateKnowledgeItem`, `deleteKnowledgeItem` (Task 3).
- Produces:
  - `knowledgeItemIdSchema = z.string().uuid()`
  - `updateKnowledgeItemAction(id: unknown, input: unknown): Promise<ActionResult<KnowledgeItem>>`
  - `deleteKnowledgeItemAction(id: unknown): Promise<ActionResult<void>>`

- [ ] **Step 1: Write the failing test**

Append to `src/server/actions/schemas.test.ts`:

```ts
import { knowledgeItemIdSchema } from "./schemas"; // add to the existing import line

describe("knowledgeItemIdSchema", () => {
  it("requires a uuid", () => {
    expect(knowledgeItemIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(knowledgeItemIdSchema.safeParse("11111111-1111-1111-1111-111111111111").success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/actions/schemas.test.ts`
Expected: FAIL — `knowledgeItemIdSchema` not exported.

- [ ] **Step 3: Add to `src/server/actions/schemas.ts`**, right after `invitationIdSchema`:

```ts
export const knowledgeItemIdSchema = z.string().uuid();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/actions/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `src/server/actions/knowledge.ts`**

```ts
import { deleteKnowledgeItem, updateKnowledgeItem } from "@/server/services/knowledge-service"; // add to the existing import

import {
  createKnowledgeItemSchema,
  knowledgeIdsSchema,
  knowledgeItemIdSchema,
  toActionError,
  type ActionResult,
} from "./schemas";

export async function updateKnowledgeItemAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<KnowledgeItem>> {
  const parsedId = knowledgeItemIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, code: "validation", message: "Invalid id" };
  const parsedInput = createKnowledgeItemSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, code: "validation", message: "Invalid knowledge item" };
  }
  try {
    const item = await updateKnowledgeItem(parsedId.data, parsedInput.data);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(`/knowledge/${parsedId.data}`);
    return { ok: true, data: item };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function deleteKnowledgeItemAction(id: unknown): Promise<ActionResult<void>> {
  const parsedId = knowledgeItemIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, code: "validation", message: "Invalid id" };
  try {
    await deleteKnowledgeItem(parsedId.data);
    revalidatePath("/today");
    revalidatePath("/library");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}
```

- [ ] **Step 6: Gates + commit**

```bash
npm test && npm run typecheck && npm run lint && npm run build
git add src/server/actions/schemas.ts src/server/actions/schemas.test.ts src/server/actions/knowledge.ts
git commit -m "feat(server): update/delete server actions"
```

---

## Task 5: Add form becomes Add-or-Edit

**Files:**
- Modify: `src/features/add/types.ts`
- Modify: `src/features/add/add-knowledge-view.tsx`
- Modify: `src/features/add/knowledge-form.tsx`
- Modify: `src/messages/nl.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: `updateKnowledgeItemAction` (Task 4); `KnowledgeItem` (`@/types`).
- Produces: `itemToValues(item: KnowledgeItem): { type: AuthableType; values: Values; examples: Example[] }`; `AddKnowledgeView({ existingItem?: KnowledgeItem })`; `KnowledgeForm({ typeLocked?: boolean, ... })`.

- [ ] **Step 1: Add i18n keys**

`src/messages/en.json`, right after `"submit": "Save to library",` (line 272):

```diff
     "submit": "Save to library",
+    "saveChanges": "Save changes",
     "required": "{field} is required",
```

`src/messages/nl.json`, same position (line 272):

```diff
     "submit": "Opslaan in bibliotheek",
+    "saveChanges": "Wijzigingen opslaan",
     "required": "{field} is verplicht",
```

- [ ] **Step 2: Add `itemToValues` to `src/features/add/types.ts`**

Append at the end of the file:

```ts
import type { KnowledgeItem } from "@/types";

/** Reverse of the Add form's payload-builder — pre-fills the form from an
 * existing item for editing. `type` is narrowed to `AuthableType` since a
 * real `KnowledgeItem` from the DB is never `"file"` (Phase 2 excludes it). */
export function itemToValues(item: KnowledgeItem): {
  type: AuthableType;
  values: Values;
  examples: Example[];
} {
  const shared = { level: item.level ?? "", tags: item.tags.join(", ") };

  switch (item.type) {
    case "vocabulary":
      return {
        type: "vocabulary",
        values: {
          ...shared,
          term: item.term,
          meaning: item.meaning,
          partOfSpeech: item.partOfSpeech,
          example: item.example ?? "",
          exampleTranslation: item.exampleTranslation ?? "",
          article: item.article ?? "",
          plural: item.plural ?? "",
          pastTense: item.pastTense ?? "",
          perfect: item.perfect ?? "",
          usageNote: item.usageNote ?? "",
        },
        examples: [],
      };
    case "grammar":
      return {
        type: "grammar",
        values: { ...shared, title: item.title, summary: item.summary, explanation: item.explanation },
        examples: item.examples.map((ex) => ({ id: crypto.randomUUID(), nl: ex.nl, en: ex.en ?? "" })),
      };
    case "reading":
      return {
        type: "reading",
        values: {
          ...shared,
          title: item.title,
          readingBody: item.body,
          summary: item.summary ?? "",
        },
        examples: [],
      };
    case "note":
      return {
        type: "note",
        values: { ...shared, title: item.title ?? "", noteBody: item.body },
        examples: [],
      };
    case "file":
      // Unreachable: the DB's knowledge_type enum excludes "file" (Phase 2 §2),
      // so no real KnowledgeItem from getKnowledgeById is ever this branch.
      throw new Error("File items cannot be edited");
  }
}
```

- [ ] **Step 2: Add `typeLocked` to `src/features/add/knowledge-form.tsx`**

```diff
   secondaryAction,
   disabled,
   error,
+  typeLocked,
 }: {
   type: PickerType;
   onTypeChange: (type: PickerType) => void;
   values: Values;
   errors: Errors;
   set: (name: string, value: string) => void;
   examples: Example[];
   setExamples: Dispatch<SetStateAction<Example[]>>;
   formRef: RefObject<HTMLFormElement | null>;
   onSubmit: (e: FormEvent) => void;
   submitLabel: string;
   secondaryAction?: ReactNode;
   disabled?: boolean;
   error?: string | null;
+  typeLocked?: boolean;
 }) {
   const t = useTranslations("add");

   return (
     <div className="flex flex-col gap-6">
-      <TypePicker value={type} onChange={onTypeChange} />
+      {typeLocked ? null : <TypePicker value={type} onChange={onTypeChange} />}
```

- [ ] **Step 3: Extend `src/features/add/add-knowledge-view.tsx`**

```diff
 import { AiCaptureBox } from "./ai-capture-box";
 import { AiFailedPanel } from "./ai-failed-panel";
 import { AiReviewBanner } from "./ai-review-banner";
 import { KnowledgeForm } from "./knowledge-form";
 import { SuccessPanel } from "./success-panel";
 import {
   type AiAttachment,
   type AuthableType,
   type Errors,
   type Example,
+  itemToValues,
   LABEL_KEY,
   type PickerType,
   REQUIRED,
   type Values,
 } from "./types";
+import { updateKnowledgeItemAction } from "@/server/actions/knowledge";
+import { useRouter } from "next/navigation";
+import type { KnowledgeItem } from "@/types";
```

```diff
-export function AddKnowledgeView() {
+export function AddKnowledgeView({ existingItem }: { existingItem?: KnowledgeItem } = {}) {
   const t = useTranslations("add");
   const tPage = useTranslations("pages.add");
+  const router = useRouter();
+  const isEditing = existingItem != null;
+  const initial = existingItem ? itemToValues(existingItem) : undefined;

   const attachParam = useSearchParams().get("attach");
   const autoOpen = attachParam === "photo" || attachParam === "file" ? attachParam : undefined;

   const [mode, setMode] = useState<Mode>("manual");
   const [rawText, setRawText] = useState("");
   const [attachment, setAttachment] = useState<AiAttachment | null>(null);
   const [noticeKey, setNoticeKey] = useState<string | undefined>();

-  const [type, setType] = useState<PickerType>("vocabulary");
-  const [values, setValues] = useState<Values>({});
-  const [examples, setExamples] = useState<Example[]>([]);
+  const [type, setType] = useState<PickerType>(initial?.type ?? "vocabulary");
+  const [values, setValues] = useState<Values>(initial?.values ?? {});
+  const [examples, setExamples] = useState<Example[]>(initial?.examples ?? []);
```

```diff
     const source: KnowledgeSource =
       mode !== "review" ? "manual" : attachment ? (attachment.kind === "image" ? "photo" : "file-upload") : "ai-assisted";
     const input = buildCreateInput(type, values, examples, source);

     setSaving(true);
     setSaveError(null);
     try {
-      const result = await createKnowledgeItemAction(input);
+      const result = isEditing
+        ? await updateKnowledgeItemAction(existingItem.id, input)
+        : await createKnowledgeItemAction(input);
       if (!result.ok) {
         setSaveError(t("errors.generic"));
         return;
       }
+      if (isEditing) {
+        router.push(`/knowledge/${existingItem.id}`);
+        return;
+      }
       // knowledgeTitle() returns "" for a titleless note — fall back to a
       // snippet of the body so the success panel still shows something.
       const title = knowledgeTitle(result.data);
       setSavedTitle(
         title || (result.data.type === "note" ? result.data.body.trim().slice(0, 50) : title),
       );
```

```diff
       secondaryAction={secondaryAction}
       disabled={saving}
       error={saveError}
+      typeLocked={isEditing}
     />
   );

   return (
     <PageContainer>
       <div className="mx-auto w-full max-w-[42rem]">
-        <PageHeader title={tPage("title")} description={tPage("subtitle")} />
+        <PageHeader
+          title={isEditing ? t("saveChanges") : tPage("title")}
+          description={isEditing ? undefined : tPage("subtitle")}
+        />

         {savedTitle !== null ? (
           <SuccessPanel title={savedTitle} onAddAnother={afterSuccess} />
         ) : mode === "processing" ? (
```

And skip the AI-capture panel entirely in edit mode — the final branch of the `mode === "manual"` render becomes:

```diff
         ) : (
           <div className="flex flex-col gap-6">
-            <AiCaptureBox
-              value={rawText}
-              onChange={setRawText}
-              attachment={attachment}
-              onAttachmentChange={setAttachment}
-              autoOpen={autoOpen}
-              onSubmit={runAi}
-            />
-            <div className="flex items-center gap-3 text-caption text-fg-muted">
-              <span className="h-px flex-1 bg-border" />
-              {t("ai.divider")}
-              <span className="h-px flex-1 bg-border" />
-            </div>
-            {form(saving ? t("ai.processing") : t("submit"))}
+            {isEditing ? null : (
+              <>
+                <AiCaptureBox
+                  value={rawText}
+                  onChange={setRawText}
+                  attachment={attachment}
+                  onAttachmentChange={setAttachment}
+                  autoOpen={autoOpen}
+                  onSubmit={runAi}
+                />
+                <div className="flex items-center gap-3 text-caption text-fg-muted">
+                  <span className="h-px flex-1 bg-border" />
+                  {t("ai.divider")}
+                  <span className="h-px flex-1 bg-border" />
+                </div>
+              </>
+            )}
+            {form(saving ? t("ai.processing") : isEditing ? t("saveChanges") : t("submit"))}
           </div>
         )}
```

(Read the actual current file before applying these diffs — line numbers have shifted since the excerpts above were captured; match by the surrounding code shown, not by line number.)

- [ ] **Step 4: Gates + commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass — there's no dedicated automated test for `itemToValues`/edit-mode UI in this task (no test runner precedent for this feature's client components beyond what already exists); gates are the verification here, plus Task 8's manual pass.

```bash
git add src/features/add/types.ts src/features/add/add-knowledge-view.tsx src/features/add/knowledge-form.tsx src/messages/nl.json src/messages/en.json
git commit -m "feat(add): reuse the Add form as an Edit form"
```

---

## Task 6: Edit route + detail-page Edit/Delete actions

**Files:**
- Create: `src/app/(app)/knowledge/[id]/edit/page.tsx`
- Modify: `src/features/knowledge/knowledge-actions.tsx`
- Modify: `src/features/knowledge/knowledge-detail-view.tsx`
- Modify: `src/messages/nl.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: `getKnowledgeById` (`@/server/services/knowledge-service`), `resolveActiveContext` (`@/server/services/session-service`), `deleteKnowledgeItemAction` (`@/server/actions/knowledge`), `useActiveGroup` (`@/lib/active-group`), `AddKnowledgeView` (`@/features/add`).

- [ ] **Step 1: Add i18n keys**

`src/messages/en.json`, in `knowledge.detail` right after `"marked": "Marked for review",` (line 99):

```diff
       "marked": "Marked for review",
+      "edit": "Edit",
+      "delete": "Delete",
+      "editedBy": "Edited by {name}",
       "meaning": "Meaning",
```

`src/messages/nl.json`, same position (line 99):

```diff
       "marked": "Gemarkeerd voor herhaling",
+      "edit": "Bewerken",
+      "delete": "Verwijderen",
+      "editedBy": "Bewerkt door {name}",
       "meaning": "Betekenis",
```

- [ ] **Step 2: Create `src/app/(app)/knowledge/[id]/edit/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AddKnowledgeView } from "@/features/add";
import { getKnowledgeById } from "@/server/services/knowledge-service";
import { resolveActiveContext } from "@/server/services/session-service";
import { knowledgeTitle } from "@/types";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]/edit">): Promise<Metadata> {
  const { id } = await params;
  const [item, t] = await Promise.all([getKnowledgeById(id), getTranslations("pages.knowledge")]);
  return { title: item ? knowledgeTitle(item) : t("metaFallback") };
}

export default async function EditKnowledgePage({ params }: PageProps<"/knowledge/[id]/edit">) {
  const { id } = await params;
  const item = await getKnowledgeById(id);
  if (!item) notFound();

  const ctx = await resolveActiveContext();
  const canModify =
    ctx.status === "ok" && (item.addedBy.id === ctx.user.id || ctx.membership.role === "owner");
  if (!canModify) redirect(`/knowledge/${id}`);

  return <AddKnowledgeView existingItem={item} />;
}
```

- [ ] **Step 3: Extend `src/features/knowledge/knowledge-actions.tsx`**

```diff
 import Link from "next/link";
-import { Bookmark, Target } from "lucide-react";
+import { Bookmark, Target, Pencil, Trash2 } from "lucide-react";
 import { useTranslations } from "next-intl";

+import { useActiveGroup } from "@/lib/active-group";
 import { useReviewMarks } from "@/lib/review-marks";
+import { deleteKnowledgeItemAction } from "@/server/actions/knowledge";
+import type { KnowledgeItem } from "@/types";
 import { buttonVariants } from "@/components/ui/button";
 import { cn } from "@/lib/utils/cn";
+import { useRouter } from "next/navigation";
+import { useState } from "react";

 export function KnowledgeActions({
-  knowledgeId,
+  item,
   practiseable,
 }: {
-  knowledgeId: string;
+  item: KnowledgeItem;
   practiseable: boolean;
 }) {
   const t = useTranslations("knowledge.detail");
+  const router = useRouter();
+  const { user, membership } = useActiveGroup();
   const [marks, toggle] = useReviewMarks();
-  const marked = marks.has(knowledgeId);
+  const marked = marks.has(item.id);
+  const canModify = item.addedBy.id === user.id || membership.role === "owner";
+  const [deleting, setDeleting] = useState(false);
+
+  const handleDelete = async () => {
+    setDeleting(true);
+    const result = await deleteKnowledgeItemAction(item.id);
+    if (result.ok) {
+      router.push("/library");
+      return;
+    }
+    setDeleting(false);
+  };

   return (
     <div className="flex flex-wrap items-center gap-3">
       {practiseable ? (
         <Link href="/practice" className={buttonVariants({ variant: "primary", size: "md" })}>
           <Target className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
           {t("practise")}
         </Link>
       ) : null}

       <button
         type="button"
-        onClick={() => toggle(knowledgeId)}
+        onClick={() => toggle(item.id)}
         aria-pressed={marked}
         className={cn(
           buttonVariants({ variant: marked ? "secondary" : "outline", size: "md" }),
           marked && "text-knowledge-vocabulary-strong",
         )}
       >
         <Bookmark
           className="-ml-0.5 size-[18px]"
           strokeWidth={2}
           fill={marked ? "currentColor" : "none"}
           aria-hidden
         />
         {marked ? t("marked") : t("markReview")}
       </button>
+
+      {canModify ? (
+        <>
+          <Link
+            href={`/knowledge/${item.id}/edit`}
+            className={buttonVariants({ variant: "outline", size: "md" })}
+          >
+            <Pencil className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
+            {t("edit")}
+          </Link>
+          <button
+            type="button"
+            onClick={handleDelete}
+            disabled={deleting}
+            className={buttonVariants({ variant: "outline", size: "md" })}
+          >
+            <Trash2 className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
+            {t("delete")}
+          </button>
+        </>
+      ) : null}
     </div>
   );
 }
```

(Move the `import { useRouter } from "next/navigation";` and `import { useState } from "react";` lines to the top of the import block, grouped with the other React/Next imports, rather than leaving them where the diff inserted them — match this file's existing import ordering convention.)

- [ ] **Step 4: Update `src/features/knowledge/knowledge-detail-view.tsx`**

```diff
-        <KnowledgeActions knowledgeId={item.id} practiseable={practiseable} />
+        <KnowledgeActions item={item} practiseable={practiseable} />
```

And add the "Edited by" note right after the existing `<MetaRow ... />` block:

```diff
           <MetaRow
             addedBy={item.addedBy}
             date={item.createdAt}
             source={{
               icon: <SourceIcon className="size-3" strokeWidth={2} aria-hidden />,
               label: tSource(item.source),
             }}
           />
+          {item.updatedBy && item.updatedBy.id !== item.addedBy.id ? (
+            <p className="text-caption text-fg-muted">{t("editedBy", { name: item.updatedBy.name })}</p>
+          ) : null}
           {item.level || item.tags.length > 0 ? (
```

- [ ] **Step 5: Gates + commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass.

```bash
git add src/app/\(app\)/knowledge/\[id\]/edit/page.tsx src/features/knowledge/knowledge-actions.tsx src/features/knowledge/knowledge-detail-view.tsx src/messages/nl.json src/messages/en.json
git commit -m "feat(knowledge): edit/delete UI, author-or-owner only"
```

---

## Task 7: RLS integration test coverage

**Files:**
- Modify: `src/server/repositories/rls.integration.test.ts`

**Interfaces:**
- Consumes: the existing `withRolledBackTx`, `seedTwoGroups`, `actAs` helpers already in this file.

- [ ] **Step 1: Append to `rls.integration.test.ts`** (inside the existing `run(...)` block):

```ts
  it("knowledge_items: the author can update their own item; a different member cannot", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA } = await seedTwoGroups(tx);
      const [item] = await tx.execute(sql`
        insert into knowledge_items (group_id, type, source, added_by, title, body)
        values (${groupA}, 'note', 'manual', ${userA}, 'orig', 'orig body')
        returning id
      `);
      const itemId = (item as { id: string }).id;

      await actAs(tx, userA);
      const updated = await tx.execute(sql`
        update knowledge_items set body = 'edited by author' where id = ${itemId} returning id
      `);
      expect(updated).toHaveLength(1);

      // A second member, not the author and not the owner of groupA, added to groupA as a plain member.
      const outsider = randomUUID();
      await tx.execute(sql`insert into auth.users (id) values (${outsider})`);
      await tx.execute(sql`
        insert into group_memberships (group_id, user_id, role) values (${groupA}, ${outsider}, 'member')
      `);
      await actAs(tx, outsider);
      const rejected = await tx.execute(sql`
        update knowledge_items set body = 'sneaky edit' where id = ${itemId} returning id
      `);
      expect(rejected).toHaveLength(0);
    });
  });

  it("knowledge_items: the group owner can update someone else's item", async () => {
    await withRolledBackTx(async (tx) => {
      const { userA, groupA } = await seedTwoGroups(tx);
      const member = randomUUID();
      await tx.execute(sql`insert into auth.users (id) values (${member})`);
      await tx.execute(sql`
        insert into group_memberships (group_id, user_id, role) values (${groupA}, ${member}, 'member')
      `);
      const [item] = await tx.execute(sql`
        insert into knowledge_items (group_id, type, source, added_by, title, body)
        values (${groupA}, 'note', 'manual', ${member}, 'orig', 'orig body')
        returning id
      `);
      const itemId = (item as { id: string }).id;

      // userA is groupA's owner (seedTwoGroups makes the group's creator its owner).
      await actAs(tx, userA);
      const updated = await tx.execute(sql`
        update knowledge_items set body = 'edited by owner' where id = ${itemId} returning id
      `);
      expect(updated).toHaveLength(1);
    });
  });
```

- [ ] **Step 2: Run against the real dev database**

```bash
TEST_DATABASE_URL="$(grep '^SUPABASE_DB_DIRECT_URL=' .env.local | cut -d= -f2-)" npx vitest run src/server/repositories/rls.integration.test.ts
```

Expected: PASS — 8 passed (6 existing + 2 new). This is safe against the live dev database — every test rolls back, per this file's existing design (see its top-of-file comment).

- [ ] **Step 3: Confirm `TEST_DATABASE_URL` is unset again**

Run: `grep '^TEST_DATABASE_URL=' .env.local`
Expected: empty value (`TEST_DATABASE_URL=`) — you did not persist a value into `.env.local` in Step 2 (the env var was only set for that one command), but double-check nothing else in this task's work left it set.

- [ ] **Step 4: Gates + commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass (the two new tests report skipped, same as the rest of this file, since `TEST_DATABASE_URL` is unset for this run).

```bash
git add src/server/repositories/rls.integration.test.ts
git commit -m "test(rls): author-or-owner update policy coverage"
```

---

## Task 8: Manual verification

Not a code task. Run through this against `npm run dev`, signed in as the seeded owner (`omarcode.business@gmail.com`) and, for the "other member" checks, a second real account invited into the same group.

- [ ] **Step 1:** As the item's author (a plain member, not the owner), open one of your own items — confirm Edit and Delete both appear.
- [ ] **Step 2:** As a different member (not that item's author, not the owner), open the same item — confirm neither Edit nor Delete appears, and that navigating directly to `/knowledge/[id]/edit` for it redirects you to the detail page instead of showing the form.
- [ ] **Step 3:** As the owner, open an item authored by someone else — confirm Edit and Delete both appear (owner override).
- [ ] **Step 4:** Edit an item (any field) and save — confirm you land back on its detail page, the change is visible immediately, and an "Edited by {your name}" note now appears (since you're not the original author in this case) — or confirm the note does **not** appear if you edited your own item (editor === author).
- [ ] **Step 5:** Delete an item — confirm it disappears from `/library`, `/today` (if it was from today), and stops appearing as a Practice/Exam distractor, immediately.
- [ ] **Step 6:** NL/EN check on the 6 new strings (`add.saveChanges`, `knowledge.detail.edit/delete/editedBy`) — no missing-key warnings in either locale.
- [ ] **Step 7:** Final gates: `npm test && npm run typecheck && npm run lint && npm run build` all pass.

This task produces no commit. If it surfaces a bug, fix it as a small follow-up commit referencing which step found it.
