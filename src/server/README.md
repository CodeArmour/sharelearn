# `src/server/` — server-side application logic (reserved)

Intentionally minimal during the frontend-foundation phase. This is where
**all** database, auth, storage and business logic will live once backend work
starts. Nothing here is implemented yet.

## Planned layout

| Directory            | Responsibility                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `server/db/`         | Database client + schema (Prisma or Drizzle — decision pending).          |
| `server/auth/`       | Session/auth helpers (Auth.js or Supabase Auth — decision pending).       |
| `server/storage/`    | File & image storage adapter (Supabase Storage or S3-compatible).         |
| `server/repositories/` | Data access — one module per aggregate (knowledge, group, practice…).   |
| `server/services/`   | Use-case orchestration; the only layer route handlers / actions call.    |

## Rules

- **Client components must never import from `src/server/`.** Server Components,
  Route Handlers and Server Actions may.
- Route/action code talks to `services`; `services` talk to `repositories` and
  `storage`; `repositories` are the only code that touches `db`.
- Return types should match the contracts in `src/types/` so the frontend does
  not change shape when mock data is replaced.

Until then, `src/data/mock/` provides the same contracts for the UI to build on.
