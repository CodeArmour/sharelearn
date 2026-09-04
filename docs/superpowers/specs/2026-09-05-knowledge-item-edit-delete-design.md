# Knowledge Item Edit & Delete

**Date:** 2026-09-05
**Status:** Approved design — pending implementation plan
**Scope:** Let the author of a knowledge item, or the group owner, edit or
delete it. Everyone else (including other members) can only view. Delete is
soft (recoverable), not destructive.

---

## 1. Context

Backend Phase 2 (merged) made the shared knowledge library real — vocabulary,
grammar, readings, notes persist in Postgres, scoped per group. It shipped
**create and read only**; Phase 2's spec explicitly listed "editing or
deleting a knowledge item" as out of scope because no UI existed for either.
Phase 2's own final review flagged the gap directly: without a delete path,
a duplicate row created by a double-submit is "permanently unremovable from
the product."

This spec closes that gap. It's scoped narrower than a full backend phase —
one new migration, a few new server functions, and reusing the existing Add
form for editing rather than building a second one.

## 2. Decisions locked before design

| Decision | Choice | Rationale |
| --- | --- | --- |
| Who can edit an item | **The item's author, or the group owner. No one else.** | Discussed directly with the group owner: in a small invite-only group, open editing (anyone can fix anyone's entry) is tempting for collaborative correction, but the owner was specifically worried about a member editing or deleting someone else's contribution out of malice or carelessness. Symmetric author-or-owner for both actions is simpler to build/reason about than two different rules, and is the safer default — loosening it later (open editing) is a trivial change; tightening it after a bad experience is not. |
| Who can delete an item | **Same rule as edit** — author or owner. | Same reasoning; delete and edit share one authorization check. |
| Delete semantics | **Soft delete** (`deleted_at` timestamp), not a real `DELETE` | Protects against exactly the accidental-or-malicious-loss scenario that motivated this whole feature. Cheap: one nullable column, filtered out of every existing read the same way `group_id` scoping already is. No "recently deleted" restore UI in v1 — recoverable via a direct DB fix if it's ever actually needed, not a polished flow nobody's asked for yet. |
| Delete UI | **Single click, no confirmation modal** | Matches the existing app convention — `revokeInvitationAction` in Group Settings already revokes an invite on a single click with no confirm dialog, and this codebase has no confirm-dialog component to reuse. Soft-delete is the actual safety net, not a client-side "are you sure?". |
| Edit form | **Reuse the existing Add form** in an edit mode (pre-filled, submits to update instead of create) | The per-type field set is identical to creation; a second form would duplicate `knowledge-form.tsx` and every type-specific fields component for no benefit. |
| Accountability | **Show "edited by X"** when `updated_by` differs from `added_by`; no full edit history/version log | Cheap (one FK column) and answers "who touched this last" without building diff storage or a revert UI nobody asked for. |
| RLS | **One new `UPDATE` policy** (`added_by = auth.uid() OR is_group_owner(group_id)`), no new `DELETE` policy | Since delete is an `UPDATE` (setting `deleted_at`), one policy covers both edit and delete at the database level. Mirrors the `is_group_member`/`is_group_owner` helper-function pattern already fixed in `0004_fix_recursive_rls.sql` — no new recursion risk. |

### Out of scope

- Version history / revert-to-previous.
- A "recently deleted" restore view.
- Editing a reading's linked-vocabulary references (`vocabulary_ids`) — no authoring UI exists for that relationship at all yet (Phase 2 §10), unaffected by this feature.
- Notifications when someone's item is edited or deleted.
- Bulk edit/delete from the Library table view — detail-page actions only, matching where `KnowledgeActions` (practise / mark-for-review) already lives.
- Rate limiting or abuse throttling.
- Any change to what happens to a member's past contributions if their membership is revoked — they stay in the shared library, unaffected by this feature (only access to the group is revoked, not authorship history).

## 3. Data model

Two new nullable columns on `knowledge_items` (migration `0005`, generated
by `drizzle-kit` since these are plain columns, not enums/policies):

| Column | Type | Notes |
| --- | --- | --- |
| `deleted_at` | `timestamptz` | `NULL` = active. Set once, on soft-delete; never cleared (no restore UI in v1). |
| `updated_by` | `uuid` references `auth.users(id)` | `NULL` until the first edit. Set to the editor's id on every update. |

No new enum, no new table. Every existing repository read
(`listKnowledgeItems`, `getKnowledgeItemById`) gains an unconditional
`deleted_at IS NULL` clause, in the same place the existing `group_id`
scoping clause lives.

### RLS (hand-written migration `0006`, mirroring `0004`'s style)

```sql
CREATE POLICY "knowledge_items_update_author_or_owner" ON "knowledge_items"
  FOR UPDATE TO authenticated
  USING (is_group_member(group_id) AND (added_by = auth.uid() OR is_group_owner(group_id)))
  WITH CHECK (is_group_member(group_id) AND (added_by = auth.uid() OR is_group_owner(group_id)));
```

Reuses `is_group_member`/`is_group_owner` from `0004_fix_recursive_rls.sql` —
no new helper functions needed. `USING` gates which existing rows a role can
target; `WITH CHECK` gates what the resulting row must satisfy — both need
the same condition here since a row's `group_id` and `added_by` don't change
on edit.

## 4. Server layer

### Repository (`server/repositories/knowledge.ts`, extended)

- `updateKnowledgeItem(tx, groupId, id, updatedBy, fields)` — an `UPDATE`
  scoped by `id` and `groupId` (defense-in-depth alongside RLS), setting
  `updated_by` and the changed fields; returns the updated row shaped as
  `KnowledgeItem`, or `null` if no row matched (already deleted, or wrong
  group).
- `softDeleteKnowledgeItem(groupId, id)` — sets `deleted_at = now()`, scoped
  by `id` and `groupId`.
- `listKnowledgeItems` / `getKnowledgeItemById` — add `deleted_at IS NULL` to
  every query's `WHERE`.

### Service (`server/services/knowledge-service.ts`, extended)

```
updateKnowledgeItem(id: string, input: CreateKnowledgeItemInput): Promise<KnowledgeItem>
deleteKnowledgeItem(id: string): Promise<void>
```

Both: resolve the actor + active group via `resolveActiveContext()` (same
pattern as `createKnowledgeItem`), load the existing item via
`getKnowledgeItemById`, throw `NotFoundError` if missing, throw
`ForbiddenError` unless `item.addedBy.id === actor.id ||
membership.role === "owner"`. `updateKnowledgeItem` reuses the exact same
zod-validated input shape as `createKnowledgeItem` (`CreateKnowledgeItemInput`
from `actions/schemas.ts`) — same per-type field set, same `wordCount`
recomputation for a reading's body.

### Actions (`server/actions/knowledge.ts`, extended)

```
updateKnowledgeItemAction(id: unknown, input: unknown): Promise<ActionResult<KnowledgeItem>>
deleteKnowledgeItemAction(id: unknown): Promise<ActionResult<void>>
```

`id` validated with the existing `z.string().uuid()` shape; `input` with the
existing `createKnowledgeItemSchema`. `ForbiddenError` maps to
`{ ok: false, code: "forbidden", message: "..." }` via the existing
`toActionError`, same as every other action in this codebase.

## 5. Frontend

### Add flow becomes Add-or-Edit

`AddKnowledgeView` gains an optional `existingItem?: KnowledgeItem` prop. When
present: the form pre-fills every field from `existingItem` (type is fixed,
not switchable, since changing an item's type mid-edit has no sensible
mapping), the submit label reads "Save changes" instead of "Save to
library," and `handleSubmit` calls `updateKnowledgeItemAction(existingItem.id,
input)` instead of `createKnowledgeItemAction(input)`. The AI-capture panel
(paste-text-to-structure) is hidden in edit mode — structuring only makes
sense for fresh capture, not for editing an already-structured item.

A new route, `/knowledge/[id]/edit`, is a Server Component that fetches the
item and redirects to `/knowledge/[id]` if the signed-in user is neither the
author nor the owner — before ever rendering the form, not after a failed
submit. (This is a UX nicety, not the real security boundary: the content
being pre-filled is already visible to any group member on the detail page,
so there's no new disclosure either way — the action's own author-or-owner
check, same as every other action in this codebase, is what actually
prevents an unauthorized save, exactly as the service never trusts a
client-supplied assumption.) Otherwise it renders `AddKnowledgeView` with the
fetched item.

### Knowledge detail page

`KnowledgeActions` (`src/features/knowledge/knowledge-actions.tsx`, already a
client component using `useReviewMarks()`) gains `useActiveGroup()` to read
`{ user, membership }`, and an `item` prop (already available in its parent,
`KnowledgeDetailView`). When `user.id === item.addedBy.id || membership.role
=== "owner"`:

- An **Edit** link to `/knowledge/[id]/edit`.
- A **Delete** button — plain `<form>` action calling
  `deleteKnowledgeItemAction(item.id)` then redirecting to `/library` on
  success, matching `revokeInvitationAction`'s single-click convention (no
  confirm modal).

`KnowledgeDetailView` also renders a small "Edited by {name}" note (using
`updated_by` joined to the editor's profile, same join pattern the repository
already uses for `added_by`) whenever `updated_by` is set and differs from
`added_by`.

## 6. i18n

New keys under `knowledge.detail.*` (both `nl.json` and `en.json`):
`edit`, `delete`, `editedBy` (`"Edited by {name}"` / `"Bewerkt door {name}"`),
plus `errors.forbidden` (a generic "you can't edit/delete this" message for
the defensive redirect case) and `errors.generic` (network/DB failure,
mirroring `add.errors.generic`'s existing pattern).

## 7. Testing

- **Unit (repository, mocked):** `updateKnowledgeItem` returns `null` for a
  wrong-group or already-deleted id; `softDeleteKnowledgeItem` sets
  `deleted_at` scoped by group.
- **Unit (service, mocked):** authorization matrix — author succeeds, owner
  succeeds, a different non-owner member gets `ForbiddenError`, for both
  `updateKnowledgeItem` and `deleteKnowledgeItem`.
- **Integration (real DB, rollback-only, extending
  `rls.integration.test.ts`):** the author can update their own item; the
  owner can update someone else's; a non-owner non-author member's `UPDATE`
  affects zero rows (RLS `WITH CHECK`/`USING` reject it) — proving the DB-level
  policy, not just the service-level check, actually holds.
- **Manual:** create an item as one member, confirm a different (non-owner)
  member sees no Edit/Delete on it; confirm the owner sees Edit/Delete on
  everyone's items; edit an item and confirm "Edited by" appears; delete an
  item and confirm it disappears from Today/Library/Practice pools
  immediately.

## 8. Migrations

- `0005_knowledge_edit_delete_columns` — generated (`deleted_at`,
  `updated_by` columns).
- `0006_knowledge_update_rls` — hand-written (`UPDATE` policy, per §3).
