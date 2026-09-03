# Backend Phase 1 — Auth, Groups & Invitations

**Date:** 2026-09-03
**Status:** Approved design — pending implementation plan
**Scope:** The first backend increment: a thin vertical slice proving the whole
architecture end-to-end. Magic-link authentication, multi-group membership,
email invitations, a post-login group picker, and a gated application shell.
**No library / practice / exam data moves to the database in this phase.**

---

## 1. Context

The Frontend Foundation phase is complete. Every product screen is built against
the typed mock accessors in `src/data/mock/`. `src/server/` and `src/ai/` are
reserved with READMEs describing a planned layout and layering rules, but nothing
is implemented.

This document covers **Phase 1 of the backend**. Follow-on phases (not designed
here):

- **Phase 2** — shared library data (knowledge, vocabulary, readings, files) in
  the database.
- **Phase 3** — personal-data persistence (practice sessions & results, exam
  attempts & results, review marks).
- **AI phase** — `src/ai/` provider, schemas, prompts, services.

Each phase gets its own spec → plan → implementation cycle.

## 2. Decisions locked before design

| Decision | Choice | Rationale |
| --- | --- | --- |
| Hosting | **Vercel** (serverless functions + edge middleware) | Chosen by product owner. |
| Data / auth / storage | **Supabase** (Postgres + Auth + Storage) | One managed service collapses three "decision pending" rows; good fit for a small private group. |
| DB access | **Drizzle ORM** + `drizzle-kit` migrations; `postgres.js` driver | SQL-first fits the reserved `repositories/` layer; schema-as-TypeScript, no codegen step, small serverless footprint. The roadmap (AI reads the DB for analysis, embeddings, analytical queries) favours Drizzle: native `vector` column + index support, and typed raw SQL vs Prisma's untyped `$queryRaw`. |
| Supabase client usage | `@supabase/supabase-js` + `@supabase/ssr` for **Auth + Storage only**. All relational data goes through Drizzle. | Keeps one query path for app data. |
| Auth method | **Magic link** (Supabase email OTP) | Passwordless; the invite email and the re-login flow are the same primitive; nothing external to configure. |
| Tenancy | **Multi-group** from day one | A user may belong to several groups and picks one after signing in. |
| Access control | Invite-gated. Authentication success is **not** access. | Owner invites an email to a specific group; a signed-in user with no membership and no pending invite reaches a dead-end, not the app. |
| Active-group representation | **Cookie-scoped** (Approach 1 below) | Keeps Phase 1 thin — existing `(app)` route tree and feature `href`s are untouched. Cookie → path is a contained follow-up if groups later need shareable URLs. |
| Authorization enforcement | **Service layer is primary**; RLS policies on the four tables are a defense-in-depth net. No per-request JWT plumbed into Drizzle. | Simple, testable; RLS still catches accidental anon-key access. |
| Invite email | Supabase's built-in OTP email (no branded / transactional email) | YAGNI for Phase 1. |
| Phase-1 surface | Thin slice only. Group Settings' member list + "invite by email" form become real (auth-domain). Knowledge / practice / exam stay on mock accessors. | Smallest surface that de-risks the architecture. |

### Approaches considered for active-group representation

- **Approach 1 — Cookie-scoped (chosen).** Existing routes unchanged; new
  `/groups` picker; middleware + `(app)/layout` resolve the active group from a
  cookie. Cost: implicit state, no direct deep-link to another group's page.
- **Approach 2 — Path-scoped `/g/[groupId]/…`.** Explicit, bookmarkable,
  multi-tab friendly. Cost: every `(app)` route moves, every internal link and
  the nav config become group-prefixed — turns a thin slice into a frontend
  refactor.
- **Approach 3 — Server-side `last_active_group_id` on the user row.** No cookie,
  survives devices. Cost: every switch writes the DB; two tabs can't view
  different groups; least explicit.

## 3. Architecture & layering

Request flow (extends `src/server/README.md`):

```
Browser
 -> middleware.ts          session refresh (@supabase/ssr) + coarse auth gate -> redirects
 -> Server Component / Route Handler / Server Action
     -> server/services/*      use-case orchestration - the only layer routes/actions call
         -> server/repositories/*   own every Drizzle query
             -> server/db/client.ts     Drizzle over postgres.js, Supabase pooler
         -> server/auth/*          Supabase server client: session + identity
```

### `server/` modules for Phase 1

| Module | Responsibility |
| --- | --- |
| `db/client.ts` | Drizzle instance on `postgres.js`, `prepare: false`, `SUPABASE_DB_POOL_URL` (pooler, :6543) |
| `db/schema.ts` | the four tables (section 4) |
| `db/migrations/` | `drizzle-kit`-generated + hand-written SQL, committed |
| `db/seed.ts` | one-time idempotent owner + first group bootstrap (admin API) |
| `auth/supabase.ts` | factories for the server / route-handler / action Supabase clients + a service-role admin client (invite lookup by email, seed) |
| `auth/session.ts` | `getSession()`, `getCurrentUser()` — **replaces the mock `getCurrentUser()`** |
| `errors.ts` | `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError` |
| `repositories/groups.ts` | `listGroupsForUser`, `getGroupById`, `getMembership` |
| `repositories/memberships.ts` | `createMembership`, `listMembers`, `getRole` |
| `repositories/invitations.ts` | `createInvitation`, `getByToken`, `getPendingByEmail`, `listPendingForGroup`, `markAccepted`, `markRevoked` |
| `repositories/profiles.ts` | `getProfile`, `upsertProfile` |
| `services/session-service.ts` | `resolveActiveContext()` — used by `(app)/layout`, the `/groups` page and the invite page (never middleware — it hits the DB) |
| `services/group-service.ts` | `getGroupsForPicker`, `switchActiveGroup`, `getGroupSettings` |
| `services/invite-service.ts` | `inviteMember`, `acceptInvitation`, `revokeInvitation` |

### Invariants (from the existing READMEs, kept)

- Client components never import from `src/server/`.
- Route/action code calls only `services`; `services` call `repositories` and
  `auth`; only `repositories` touch `db`.
- Only `auth/` imports the Supabase auth SDK.
- Service / repository return types match the contracts in `src/types/` so the
  frontend does not change shape when mock data is replaced.

### Environment variables (`.env.example`)

| Var | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only admin client (invite lookup, seed) |
| `SUPABASE_DB_POOL_URL` | Drizzle runtime — pooler :6543, `?pgbouncer=true`, no prepared statements |
| `SUPABASE_DB_DIRECT_URL` | `drizzle-kit` migrations only — direct :5432 |
| `SITE_URL` | building `emailRedirectTo` |

### Next.js 16 verification points

`AGENTS.md` warns this Next.js differs from training data. Before writing code,
read the relevant guides under `node_modules/next/dist/docs/` and confirm:

- `middleware.ts` location, `config.matcher` shape, and the request/response
  API used for cookie mutation with `@supabase/ssr`.
- Server Action declaration and return-value conventions.
- Route Handler signature for `GET (auth)/auth/callback`.

## 4. Data model

Four tables in `public`, all with RLS enabled. Foreign keys reference the
Supabase-managed `auth.users(id)`. The Drizzle schema declares a minimal external
`auth.users` stub for FK typing; `drizzle.config.ts` sets
`schemaFilter: ["public"]` so migrations never touch the `auth` schema.

### Enums (Drizzle `pgEnum`)

- `member_role` = `('owner', 'member')`
- `invitation_status` = `('pending', 'accepted', 'revoked')`

### Extensions (migration `0001`)

- `citext` — case-insensitive invitation email.
- `vector` — enabled now, unused in Phase 1, so later AI migrations are purely
  additive.

### `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | references `auth.users(id)` on delete cascade |
| `display_name` | `text` not null | derived from email local-part until user editing exists |
| `initials` | `text` not null | 2 chars, derived |
| `accent` | `text` not null | one of the avatar accent tokens; derived (hash of id) |
| `created_at` | `timestamptz` not null default `now()` | |

Exists only so the real `getCurrentUser()` returns the shape `src/types` `User`
already requires. Upserted by `acceptInvitation` and, defensively, by
`resolveActiveContext` if missing. Profile editing is a later phase.

### `groups`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `name` | `text` not null | |
| `slug` | `text` not null unique | generated from name; reserved for a future `/g/[slug]` URL |
| `created_by` | `uuid` not null | references `auth.users(id)` |
| `created_at` | `timestamptz` not null default `now()` | |

### `group_memberships`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `group_id` | `uuid` not null | references `groups(id)` on delete cascade |
| `user_id` | `uuid` not null | references `auth.users(id)` on delete cascade |
| `role` | `member_role` not null | |
| `created_at` | `timestamptz` not null default `now()` | |

- `unique (group_id, user_id)`
- index on `user_id` (picker query)
- index on `group_id` (member list)

### `invitations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `group_id` | `uuid` not null | references `groups(id)` on delete cascade |
| `email` | `citext` not null | |
| `token` | `text` not null unique | 32 random bytes, base64url; carried in the magic-link `emailRedirectTo` |
| `role` | `member_role` not null default `'member'` | |
| `invited_by` | `uuid` not null | references `auth.users(id)` |
| `status` | `invitation_status` not null default `'pending'` | |
| `expires_at` | `timestamptz` not null | set in the service (`now() + 7 days`), not a DB default |
| `accepted_at` | `timestamptz` | |
| `created_at` | `timestamptz` not null default `now()` | |

- partial `unique (group_id, email) where status = 'pending'` — no duplicate
  pending invites
- index on `email` (pending-by-email lookup)
- index on `token`

### RLS stance

Primary authorization is the **service layer**: every repository function that
reads or writes group-scoped data takes an `actor` and scopes by `groupId`. RLS
policies are a **defense-in-depth net** for any accidental anon-key access:

- `profiles` — authenticated `select`; `update` only `id = auth.uid()`.
- `groups` — `select` where `id in (select group_id from group_memberships where
  user_id = auth.uid())`.
- `group_memberships` — `select` rows for groups the caller belongs to.
- `invitations` — all operations restricted to an `owner` of `group_id`. The
  accept path runs server-side with the service role, so no invitee-facing
  policy is required.

The user JWT is **not** plumbed into Drizzle for per-request RLS in Phase 1.

### Seed (`server/db/seed.ts`)

One-time, idempotent, uses the Supabase admin API:

1. Ensure an auth user for `OWNER_EMAIL` (create with `email_confirm: true` if
   absent).
2. Upsert one `group` by a fixed slug.
3. Upsert the owner `group_membership` (`role = 'owner'`) and `profile`.

Gives a working owner with no email round-trip. Everyone else joins via the
invite flow. Safe to re-run.

## 5. Auth flow & routing

### Routes

| Route | Type | Behaviour |
| --- | --- | --- |
| `(auth)/login` *(rewrite)* | page + action | One email field -> `sendMagicLink` action -> `signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true } })`. Renders a "check your email" state. |
| `(auth)/auth/callback` | route handler | Supabase redirects here with a PKCE `code`. `exchangeCodeForSession` -> if the link carried an invite `token`, redirect `/invite/[token]`; else redirect `/`. |
| `(auth)/invite/[token]` | page (server component) + `<InviteOutcome>` | Requires a session (else redirect `/login` — the magic link in the invite email still carries the token, so re-initiating sign-in there resumes the flow). Calls `acceptInvitation({ token })`. Success -> set active-group cookie -> redirect `/today`. Failure -> explanatory state (`expired` / `revoked` / `email-mismatch` / `already-member` / `not-found`) + link onward. |
| `(picker)/groups` | page + bare `(picker)/layout.tsx` (brand mark only, no `AppShell`) | `<GroupPicker>` lists `getGroupsForPicker()`; each row is a form calling `switchActiveGroup(groupId)` -> cookie -> `/today`. Empty list -> `<NoGroupAccess>` ("You're not in any group yet - ask an owner to invite you") + sign-out. |
| `(app)/layout` *(rewrite)* | layout | Calls `resolveActiveContext()`: `needs-login` -> `/login`; `needs-group` / `no-access` -> `/groups`; `ok` -> wrap children in `<ActiveGroupProvider>` with `{ user, activeGroup, membership }` and render `<AppShell>`. |

### `middleware.ts` (Edge-light, no DB)

1. `@supabase/ssr` session-cookie refresh so RSCs see a fresh session.
2. Coarse gate only: an `(app)` path with no session -> `/login`; `/login` with a
   session -> `/`. Membership / active-group checks belong to `(app)/layout`,
   which is allowed to hit the DB.

### Active-group cookie

- Name `dutch.active_group` — httpOnly, secure, sameSite=lax, path=/, ~1 year.
- Written only by `switchActiveGroup` and `acceptInvitation` (server-side).
- `resolveActiveContext` ignores and clears it if the group is not in the
  caller's memberships.
- If the user has exactly one membership and no cookie -> auto-select it and set
  the cookie (the picker only matters when there is a choice).

### Magic-link specifics

- `signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true } })`.
- `emailRedirectTo` = `${SITE_URL}/auth/callback`, plus `?token=<inviteToken>`
  when initiated from an invite.
- The invite email and the plain re-login email are the same Supabase OTP email.
- Rate-limiting relies on Supabase defaults for Phase 1. The login form shows a
  neutral "check your email" message regardless of whether the address is known.

### Sign out

`signOut` action: `supabase.auth.signOut()` + delete the active-group cookie ->
redirect `/login`. Replaces the current logout nav link.

### `getCurrentUser`

`data/mock`'s `getCurrentUser` is removed. Callers repoint to
`server/auth/session.getCurrentUser()` (returns `profiles` joined with
`auth.users.email`, shaped as `src/types` `User`). Client-component callers read
from `useActiveGroup()` or a server-parent prop instead of importing server code.

## 6. Services, repositories, actions

### Repositories (own every Drizzle query; no authorization logic)

- `groups.ts` — `listGroupsForUser(userId)`, `getGroupById(id)`,
  `getMembership(userId, groupId)`
- `memberships.ts` — `createMembership(tx, {...})`, `listMembers(groupId)`
  (joined with `profiles`), `getRole(userId, groupId)`
- `invitations.ts` — `createInvitation(tx, {...})`, `getByToken(token)`,
  `getPendingByEmail(email)`, `listPendingForGroup(groupId)`,
  `markAccepted(tx, id)`, `markRevoked(id)`
- `profiles.ts` — `getProfile(userId)`, `upsertProfile(tx, {...})`

### Services (the only layer actions / routes call)

Services **resolve the actor themselves** via `auth/session` so an action cannot
pass a spoofed actor.

| Service fn | Authorization | Behaviour |
| --- | --- | --- |
| `resolveActiveContext()` | — | session -> memberships -> cookie. Returns `{ status: 'ok', user, activeGroup, membership }` or `{ status: 'needs-login' }` or `{ status: 'needs-group' }` or `{ status: 'no-access' }`. |
| `getGroupsForPicker()` | any member | picker list `{ id, name, slug, role }[]` |
| `switchActiveGroup(groupId)` | caller must be a member of `groupId` | validates membership, sets cookie (caller performs the redirect) |
| `getGroupSettings()` | any member; `pendingInvites` populated **owner-only** | `{ group, members, pendingInvites, viewerRole }` |
| `inviteMember({ email })` | **owner** of the active group | validates email; rejects an existing member or an existing pending invite; in a transaction creates the `invitations` row; sends the OTP email with `emailRedirectTo=${SITE_URL}/auth/callback?token=<token>` |
| `acceptInvitation({ token })` | the session email must equal `invitation.email` (citext) | loads by token; validates `status = 'pending'`, not expired, email match, not already a member; in one transaction `createMembership` + `markAccepted` + `upsertProfile` (derive initials/accent when no profile). Returns `{ groupId }`. Error variants: `expired`, `revoked`, `email-mismatch`, `already-member`, `not-found`. |
| `revokeInvitation({ invitationId })` | **owner** | `markRevoked` |

### Server Actions

`sendMagicLink`, `signOut`, `switchActiveGroup`, `inviteMember`,
`revokeInvitation`. Each:

- validates input with a **zod** schema (`email`, `token`, `groupId` uuid,
  `invitationId` uuid) before touching a service;
- catches typed errors from `server/errors.ts` and returns a discriminated
  `{ ok: false, code }` result — actions never throw to the client;
- returns `{ ok: true, ... }` on success.

### Route Handler

`GET (auth)/auth/callback` only (the PKCE exchange). Invite acceptance runs in
the `(auth)/invite/[token]` server-component body, not an action, because it is a
GET landing.

### Error handling

`server/errors.ts` typed errors; `(app)/error.tsx` (already present) is the
backstop for unexpected server errors. Invite-failure states are rendered
explicitly by `<InviteOutcome>`.

## 7. Frontend integration & i18n

### New files

| Path | Purpose |
| --- | --- |
| `src/middleware.ts` | session refresh + coarse gate |
| `src/app/(auth)/auth/callback/route.ts` | PKCE exchange (no UI) |
| `src/app/(auth)/invite/[token]/page.tsx` + `<InviteOutcome>` | accept landing + success / error states |
| `src/app/(picker)/layout.tsx` + `src/app/(picker)/groups/page.tsx` | bare centered layout + `<GroupPicker>` / `<NoGroupAccess>` |
| `src/lib/active-group.tsx` | `ActiveGroupProvider` + `useActiveGroup()` -> `{ group, membership, user }` (mirrors the `useReviewMarks` style) |
| `src/components/navigation/sign-out-item.tsx` | nav slot that submits the `signOut` action instead of linking |

### Rewritten files

| Path | Change |
| --- | --- |
| `src/app/(auth)/login/page.tsx` | real `<MagicLinkForm>` (email -> `sendMagicLink` -> "check your email" state) |
| `src/app/(app)/layout.tsx` | `resolveActiveContext()` -> redirects -> `<ActiveGroupProvider>` wrapping `<AppShell>` |
| `src/features/group/*` | member list from `getGroupSettings()`; owner-only invite form (`inviteMember`) + pending list with revoke (`revokeInvitation`) — same layout, real data |
| `src/lib/config/navigation.ts` | logout entry renders `<SignOutItem>`, not a `/login` link |
| `getCurrentUser` callers (`features/profile`, `MetaRow`, sidebar footer, `MobileTopBar`) | repoint to `server/auth/session`; client callers read from `useActiveGroup()` / a server-parent prop |
| `src/data/mock/index.ts` | drop `getCurrentUser`; **all knowledge / practice / exam accessors untouched** |
| `.env.example` | add the six variables from section 3 |

### i18n

New namespaces in both `src/messages/nl.json` and `src/messages/en.json` (key
parity; NL is the default and the length stress-case):

- `auth.login.*` — title, emailLabel, emailPlaceholder, submit, sending,
  sentTitle, sentBody, sentResend, errorGeneric
- `auth.invite.*` — acceptingTitle, successBody, `error.expired`,
  `error.revoked`, `error.emailMismatch`, `error.alreadyMember`,
  `error.notFound`, toLogin, toGroups
- `groups.picker.*` — title, subtitle, chooseCta, continueIn
- `groups.noAccess.*` — title, body, signOut
- `group.settings.invite.*` — sectionTitle, emailLabel, emailPlaceholder, submit,
  pendingTitle, pendingEmpty, revoke, invitedBy, expires, statusPending
- `group.settings.members.*` — sectionTitle, roleOwner, roleMember, joined, you
- `group.settings.errors.*` — notOwner, alreadyMember, alreadyInvited,
  invalidEmail, generic

### Untouched

Today, Library, Knowledge, Practice, Exam, Add and their mock data; review marks
(localStorage); the design system and tokens; the `AppShell` chrome.

## 8. Dependencies, migrations, testing

### Dependencies

- runtime: `drizzle-orm`, `postgres`, `@supabase/supabase-js`, `@supabase/ssr`,
  `zod`
- dev: `drizzle-kit`, `vitest`, `@testing-library/react`

### Scripts (`package.json`)

| Script | Command |
| --- | --- |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate` | `drizzle-kit migrate` (uses `SUPABASE_DB_DIRECT_URL`) |
| `db:seed` | run `server/db/seed.ts` with `.env.local` loaded |
| `test` | `vitest run` |

`drizzle.config.ts` at the repo root: `schema: ./src/server/db/schema.ts`,
`out: ./src/server/db/migrations`, `dialect: 'postgresql'`,
`dbCredentials.url = SUPABASE_DB_DIRECT_URL`, `schemaFilter: ["public"]`.

### Migrations

- `0000_init` — enums, four tables, indexes, foreign keys (generated).
- `0001_extensions_rls` — `citext` + `vector` extensions, `enable row level
  security` on all four tables, the policies from section 4 (hand-written SQL
  migration).

### Testing

The project has no test runner today; Phase 1 adds **Vitest**.

- **Unit (no DB):**
  - `acceptInvitation` decision table — expired / revoked / email-mismatch /
    already-member / not-found / happy path (repositories mocked).
  - `resolveActiveContext` branch table — no session / no memberships / stale
    cookie / single-membership auto-select / valid cookie.
  - `inviteMember` authorization — non-owner -> `ForbiddenError`; duplicate
    pending -> `ConflictError`; invalid email -> `ValidationError`.
  - zod action schemas — accept / reject fixtures.
  - initials / accent derivation helper.
- **Integration (real DB, local `supabase start`, gated on
  `TEST_DATABASE_URL`, skipped when unset):**
  - invite -> accept -> membership row -> picker list.
  - `switchActiveGroup` rejects a non-member.
  - RLS smoke — an anon-key `select` on `groups` returns only the caller's rows.
- **Manual review checklist** (ships with this spec, section 9).
- Existing gates stay green: `npm run typecheck && npm run lint && npm run
  build`. `npm test` is added to the expected pre-commit set.

## 9. Verification

### Order of work

1. Schema + migrations + seed against a dev Supabase project; eyeball with
   `drizzle-kit studio`.
2. Auth plumbing (`middleware`, `auth/callback`, `getCurrentUser`) — confirm a
   session survives a hard refresh.
3. Picker + `(app)/layout` gate — confirm redirects with the seeded owner.
4. Invite + accept — confirm in a second browser profile.
5. Group Settings real data (members, invite, revoke).
6. Full manual checklist, NL and EN.
7. Deploy to a Vercel preview with the real Supabase env; re-run the checklist on
   the preview URL.

### Manual review checklist

- [ ] Fresh sign-in: unknown email -> "check your email" -> link -> `/groups`
      dead-end (`no-access`).
- [ ] Seeded owner sign-in -> auto-selected group (single membership) -> `/today`.
- [ ] Owner invites an email; invitee accepts in a separate browser profile ->
      lands in `/today` for that group.
- [ ] Invite accepted while logged in as the wrong email -> `email-mismatch`
      state, no membership created.
- [ ] Expired invite (`expires_at` in the past) -> `expired` state.
- [ ] Revoked invite -> `revoked` state.
- [ ] `logout` -> `/login`; sign back in via the email field.
- [ ] User in two groups -> picker lists both -> switching changes the active
      group and `/today` content scope.
- [ ] Group Settings: owner sees members + pending invites + invite form + revoke;
      member sees members only.
- [ ] Direct navigation to `/today` with no session -> `/login`; with a session
      but no membership -> `/groups`.
- [ ] Every new string renders in NL (default) and EN with no key warnings and no
      layout break at ~360px and >= lg.

## 10. Out of scope for Phase 1

- Any library / vocabulary / reading / file data in the database (Phase 2).
- Practice / exam result and review-mark persistence (Phase 3).
- Profile editing (display name, avatar, accent) — values are derived only.
- Branded / transactional invite email — Supabase OTP email only.
- Realtime / multiplayer.
- Group-creation UI — the seed makes the first group; more groups are a later
  concern.
- Roles beyond `owner` / `member`; ownership transfer; leaving a group.
- Rate-limiting beyond Supabase defaults.
- The public landing page.
- `src/ai/` — untouched.
