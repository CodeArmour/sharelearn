# `src/server/` — server-side application logic

All database, auth and business logic. Backed by Supabase (Postgres + Auth) with
Drizzle ORM; see `docs/superpowers/specs/` for the per-phase design docs.

## Layout

| Directory            | Responsibility                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `server/db/`         | Drizzle client + schema + migrations.                                    |
| `server/auth/`       | Supabase Auth session helpers.                                           |
| `server/repositories/` | Data access — one module per aggregate (knowledge, groups, personal…). |
| `server/services/`   | Use-case orchestration; the only layer route handlers / actions call.    |
| `server/actions/`    | `"use server"` entry points; validate input, call a service.             |

Storage (files) is not yet implemented — `FileItem.url` stays `null`.

## Rules

- **Client components must never import from `src/server/`.** Server Components,
  Route Handlers and Server Actions may.
- Route/action code talks to `services`; `services` talk to `repositories` and
  `storage`; `repositories` are the only code that touches `db`.
- Return types match the contracts in `src/types/`, so the frontend shape does
  not depend on where the data comes from.
