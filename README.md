# Welkom

A private, collaborative learning workspace for a small group learning Dutch.
Members capture vocabulary, grammar, readings and files, structure them (with AI
help, later), browse the shared library, practise, and prepare for exams.

> **Current phase: Frontend Foundation.**
> Architecture, design system, application shell and mock-data layer only.
> Database, authentication, file storage, the AI provider and real server
> business logic are intentionally **not** implemented yet — the codebase
> reserves clean seams for them (`src/server/`, `src/ai/`).

## Tech stack

| Area       | Choice                                             |
| ---------- | ------------------------------------------------- |
| Framework  | Next.js 16 (App Router, React Server Components)   |
| Language   | TypeScript (strict)                               |
| Styling    | Tailwind CSS v4 + CSS-variable design tokens       |
| UI variants| class-variance-authority                          |
| Icons      | lucide-react                                      |
| Fonts      | Poppins / Inter / Lora via `next/font` (self-hosted) |
| Lint/format| ESLint (flat config) + Prettier                  |

Design source of truth: the approved Figma file *Dutch Shared Learning Platform
— Production UI*. Tokens in `src/app/globals.css` are exported from its Figma
variables; components mirror the Figma component set.

## Getting started

```bash
npm install
cp .env.example .env.local   # nothing required to run the foundation
npm run db:migrate           # apply Drizzle migrations to Supabase
OWNER_EMAIL=you@example.com npm run db:seed   # bootstrap the first group + owner
npm run dev                  # http://localhost:3000  → redirects to /today
```

| Script                 | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | Dev server (Turbopack)                   |
| `npm run build`        | Production build                        |
| `npm start`            | Serve the production build              |
| `npm run lint`         | ESLint                                  |
| `npm run typecheck`    | `tsc --noEmit`                          |
| `npm run format`       | Prettier write                          |
| `npm test`             | Vitest run                              |
| `npm run db:generate`  | Generate Drizzle migrations from schema |
| `npm run db:migrate`   | Apply Drizzle migrations to Supabase    |
| `npm run db:seed`      | Idempotent first group + owner bootstrap |

`/foundation` renders every design token, the type scale and the base
components inside the shell — a development reference, not a product page.

## Architecture

```
src/
├── app/                     Routing only — routes compose feature components
│   ├── (auth)/login/          unauthenticated area (no shell)
│   └── (app)/                 authenticated area (persistent shell)
│       ├── layout.tsx         renders <AppShell>
│       ├── today/  library/  practice/  exam/  add/  profile/
│       ├── settings/group/    knowledge/[id]/   foundation/  (dev)
│       └── error.tsx
├── components/
│   ├── ui/                   design-system primitives (Button, Badge, …) — no domain logic
│   ├── layout/              AppShell, PageContainer, PageHeader, Section
│   ├── navigation/          DesktopSidebar, MobileBottomNav, NavItem, BrandMark, Add action
│   └── shared/              cross-feature helpers
├── features/                domain-oriented UI, one folder per screen/area
├── lib/
│   ├── config/navigation.ts single source of truth for nav
│   └── utils/cn.ts          class-name merge helper
├── types/                   frontend/domain contracts (knowledge, user, cefr, personal)
├── server/                  db / auth / repositories / services / actions (README)
└── ai/                      providers / schemas / prompts / services (README)
```

### Directory responsibilities

- **`app/`** — routing and page composition only; no business logic, no large UI.
- **`components/ui/`** — generic, reusable, unaware of Dutch-learning concepts.
- **`components/layout` + `components/navigation`** — the application shell.
- **`features/<name>/`** — everything specific to one screen/domain area
  (`components/`, `hooks/`, `types/`, `utils/`). Created when a screen needs it.
- **`server/`, `ai/`** — data, auth, business logic and AI; see their READMEs.
  Screens reach them through Server Components and Server Actions. **Client
  components must never import from `server/` or `ai/`** (except `ai/providers/config`).

### Shared vs personal data

- **Shared** (group library): knowledge, vocabulary, grammar, readings, files.
- **Personal** (per user): practice sessions & results, exam attempts & results,
  vocabulary marked for review. See `src/types/personal.ts`.

## Design system

`src/app/globals.css` defines two tiers:

1. **Primitives** — raw colour ramps in `:root` (never referenced by UI).
2. **Semantic tokens** — in Tailwind v4 `@theme`, exposed both as utilities
   (`bg-surface`, `text-fg-muted`, `border-border-strong`, `rounded-card`,
   `shadow-card`, `text-knowledge-vocabulary`, `text-h1`, `font-display`, …) and
   as CSS variables (`var(--color-surface)`, `var(--radius-card)`).

Type scale keys pair with a font utility: headings/titles use `font-display`
(Poppins), body/UI uses `font-sans` (Inter), long-form uses `font-reading`
(Lora).

## Responsive model

Not "desktop scaled down". Two distinct chrome treatments:

- **≥ `lg`** — fixed 264px `DesktopSidebar`.
- **< `lg`** — fixed bottom `MobileBottomNav` with a raised capture FAB;
  content reserves bottom space and respects the safe-area inset.

## Roadmap (after foundation approval)

Today → Library → Library vocabulary table/study mode → Knowledge Detail → Add
Knowledge → AI Review → Practice (Setup/Session/Results) → Exam
(Setup/Session/Results) → Profile → Group Settings → Mobile refinement.
