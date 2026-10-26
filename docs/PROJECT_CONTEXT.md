# Project Context

This is a maintained handoff note for future coding sessions. Update it when a
feature changes its architecture or external-service configuration.

## Product

Welkom is a private, group-based Dutch learning app. A group shares a knowledge
library containing vocabulary, grammar, readings, and notes. Members create and
review material, practise with generated questions, and take timed exams.

## Stack

- Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, and `next-intl`.
- Server actions handle mutations; route handlers serve cron jobs.
- Supabase provides Auth, PostgreSQL, and Storage.
- Drizzle ORM defines database access and migrations.
- OpenAI Responses API is isolated behind `src/ai/providers/`.
- Tests use Vitest and Testing Library. Run `npm run typecheck` and `npm test`.

## Structure

- `src/app/`: App Router pages and API routes.
- `src/features/`: feature-level client components and view logic.
- `src/server/actions/`: validated Server Actions with active-group checks.
- `src/server/services/`: database and domain services.
- `src/ai/`: prompts, schemas, services, and provider adapters.
- `src/lib/supabase/`: browser/server Supabase clients and shared constants.
- `src/messages/en.json` and `src/messages/nl.json`: translation source of truth.
- `docs/`: operational setup notes and architecture context.

## Domain Model

- A user can belong to multiple groups; the active group governs all library
  access and writes.
- Knowledge items are one of `vocabulary`, `grammar`, `reading`, or `note`.
- Knowledge is shared within the active group. Review state and practice history
  remain private to the member.
- Practice sessions and exams randomly sample questions, distractors, and answer choices. Their
  vocabulary sections use Dutch sentence-completion questions rather than meaning prompts.
- AI output is always reviewable before it becomes a normal knowledge item.

## Authentication and Supabase

- Supabase Auth manages sessions. The server resolves the active context before
  any protected action runs.
- Invites are two-stage: the Supabase Invite user email carries an application
  token in `user_metadata.invite_token`; `/auth/callback` establishes the auth
  session, then `/invite/<token>` creates the group membership. If a session is
  still required, the token is preserved through `/login?invite=...`, including
  magic-link and code verification.
- `docs/email-templates/invite.html` must stay synchronized with Supabase
  Authentication > Emails > Invite user. Its button uses `.SiteURL`,
  `.Data.invite_token`, and `.TokenHash` rather than `.RedirectTo`.
- RLS protects group records. Service-role access is limited to server-only cron
  tasks and operational tooling.
- Storage bucket `knowledge-capture-staging` is private. Its RLS policies only
  allow objects under the signed-in user's `{userId}/...` prefix.
- Configure the bucket for a 5 MB per-file limit and JPEG, PDF, XLS, and XLSX
  MIME types. The exact setup is in `docs/supabase-storage-capture.md`.
- Daily Vercel cron jobs include the staging-object sweep at 03:00. They require
  `Authorization: Bearer $CRON_SECRET`.

## AI

- `AI_API_KEY` gates all AI UI and services. Without it, manual creation still
  works and AI services return an unavailable result.
- Default model is `gpt-5.6-luna`; fallback is `gpt-5.6-terra`.
- Provider calls return structured JSON and are validated with Zod before they
  reach application code.
- Do not import a provider SDK outside `src/ai/providers/`.

### AI Capture Flow

1. Pasted text produces one suggestion through `structureKnowledgeAction`.
2. File capture accepts one to three photos, PDFs, `.xls`, or `.xlsx` files.
3. Images are re-encoded as JPEG in the browser; PDF and Excel bytes retain
   their canonical MIME type.
4. The client uploads temporary objects beneath the authenticated user's prefix
   in `knowledge-capture-staging`.
5. Standard file capture uses `extractFromFilesAction`, which confirms the
   owner prefix, creates short-lived signed URLs for images, embeds PDF bytes
   for document input, and removes staged objects in `finally`.
6. A single `.xls` or `.xlsx` upload uses the spreadsheet import path instead:
   `readSpreadsheetBatch` extracts labelled cell text on the server and sends
   25 data rows at a time to AI. It caps a workbook at 5,000 non-empty data
   rows, 24 columns, and 300 characters per cell.
7. `extractSpreadsheetBatchAction` preserves the staged workbook until the
   user saves the final batch or cancels. `discardSpreadsheetImportAction` and
   the daily storage sweep are cleanup backstops.
8. The user edits/selects each AI batch in the review checklist. Saving a
   batch automatically opens the next one; only confirmed knowledge entries
   persist and source attachments never enter the knowledge database.

Key files:

- `src/features/add/file-capture-panel.tsx`: file picker and feedback.
- `src/features/add/capture-files.ts`: accepted types, size limit, preparation.
- `src/features/add/add-knowledge-view.tsx`: browser upload and review flow.
- `src/server/actions/ai.ts`: ownership, signing, extraction, and cleanup.
- `src/ai/services/knowledge-extractor.ts`: attachment-to-suggestion service.
- `src/ai/services/spreadsheet-import.ts`: bounded XLS/XLSX row parsing.
- `src/ai/providers/openai.ts`: Responses API attachment mapping.

## Development Rules

- Read the relevant Next 16 documentation under `node_modules/next/dist/docs/`
  before changing Next behavior.
- Keep Server Action input validation in `src/server/actions/schemas.ts`.
- Maintain English and Dutch messages together when changing user-facing copy.
- Preserve the review-before-persist model for AI-generated content.
- Treat uploaded capture objects as temporary. Do not expose a public bucket or
  retain source files without an explicit product and storage-design change.

## Current Validation

For the file-capture feature, targeted tests cover accepted files, client-side
limits, browser preparation, server action ownership/cleanup, extractor
attachment mapping, and Responses API `input_file` construction.
