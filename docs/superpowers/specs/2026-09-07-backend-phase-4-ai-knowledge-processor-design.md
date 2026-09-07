# Backend Phase 4 — AI Knowledge Processor

**Date:** 2026-09-07
**Status:** Implemented — branch feature/backend-phase-4-ai-knowledge-processor (manual smoke pending owner)
**Scope:** The first slice of the AI phase. Stand up the reserved `src/ai/`
layer with a real Anthropic provider and replace the simulated
`getAiSuggestion(rawText)` structuring step on the Add-knowledge screen with a
real one. A thin vertical slice that proves the `providers → schemas → prompts
→ services` architecture end-to-end, exactly as Backend Phase 1 did for
`src/server/`.

**No attachments, no other AI services, no embeddings in this phase.**

---

## 1. Context

Backend Phases 1–3 are merged: auth/groups/invites, shared library data, and
personal-data persistence all run against Supabase + Drizzle. `src/ai/` remains
reserved — only a `README.md` describing the planned four-directory layout
(`providers/`, `schemas/`, `prompts/`, `services/`) and its layering rules.

The Add-knowledge screen (`src/features/add/add-knowledge-view.tsx`) offers two
capture paths. The manual path is a plain form wired to
`createKnowledgeItemAction` since Phase 2. The **AI path** hands pasted text (or
a picked file's metadata) to a simulated structuring step —
`getAiSuggestion` / `getAiSuggestionFromAttachment` in `src/data/mock/index.ts`,
imported **directly into the client component** — which returns an
`AiSuggestion` proposal; the reviewer always confirms in the pre-filled form
before anything is written.

### What Phase 4 replaces

| Today | After Phase 4 |
| --- | --- |
| `getAiSuggestion(rawText)` — heuristic regex classifier in `src/data/mock/index.ts`, called client-side via `window.setTimeout` | `structureKnowledgeAction(rawText)` Server Action → `src/ai/services/knowledge-processor.ts` → real Anthropic call, schema-validated, mapped to the unchanged `AiSuggestion` shape |
| `getAiSuggestionFromAttachment({ name, kind })` — filename-only stub | **Removed from this screen.** The photo/file attach buttons are hidden; multimodal capture is a later slice. |
| `AiSuggestion.noticeKey` — any of 7 `add.ai.notice.*` keys, chosen by the mock | A closed `z.enum` of the **4 text-path keys**; the model picks one or omits it |

### Draft contract that already exists

`src/types/ai.ts` — `AiSuggestion` (`{ type, fields: Record<string,string>,
examples?, noticeKey? }`) and `AiAttachmentKind`. The client consumes
`AiSuggestion`; **this contract does not change**, so the five components that
render the review form are untouched.

## 2. Decisions locked before design

| Decision | Choice | Rationale |
| --- | --- | --- |
| Slice size | `KnowledgeProcessor` only, text-paste input only | Smallest surface that stands up `src/ai/` end-to-end. Explainer / practice-gen / answer-eval / embeddings are separate later slices. |
| Provider isolation | Real `ai/providers/` adapter behind one internal interface; **no `@anthropic-ai/sdk` import outside `ai/providers/`** | The `src/ai/README.md` rule. Keeps provider swappable and lets later AI slices reuse client setup, retries, and error mapping. |
| SDK | `@anthropic-ai/sdk` (official), one non-streaming `messages.parse()` call with `output_config.format` (structured outputs) | Single structured extraction — no streaming, no tool loop. `messages.parse()` validates the response against the schema for us. |
| Model default | `claude-sonnet-5`, overridable via `AI_MODEL` | Bounded structured-extraction task; Sonnet 5 is fast, ~⅕ the cost of Opus 5, and comfortably capable here. Matches the `.env.example` placeholder and the "small private group / cost cap only" framing. |
| Missing API key | **Graceful degradation.** `AI_API_KEY` is optional. When unset, `getAiProvider()` returns `null`, the action returns `ai-unavailable`, and the Add screen renders the manual form only (no AI capture box, no divider). | A fresh clone and CI must run without a key. Mirrors how Phase 1 kept integration tests skippable without a test DB. |
| `noticeKey` | Closed `z.enum` of the 4 text-path keys; model picks one or omits | Predictable, already translated (NL/EN), and cheap to validate. Model-authored free text would add an untranslated string to the UI. |
| Guardrails | **Input length cap only** — `z.string().trim().min(2).max(10_000)` at the action boundary | Invite-gating already limits who can call this. No rate-limit or spend-ceiling infra in this slice. |
| Authorization | The action requires an active group context (`resolveActiveContext()`), same as every other Server Action. No group data is read or written — structuring is stateless. | Consistency; keeps an unauthenticated caller out. |

## 3. Architecture & layering

```
add-knowledge-view.tsx (client)
  └─ structureKnowledgeAction(rawText)        src/server/actions/ai.ts
       └─ structureKnowledge(rawText)         src/ai/services/knowledge-processor.ts
            ├─ getAiProvider()                src/ai/providers/index.ts
            │    └─ AnthropicProvider         src/ai/providers/anthropic.ts  ──►  @anthropic-ai/sdk
            ├─ KNOWLEDGE_PROCESSOR_PROMPT_V1  src/ai/prompts/knowledge-processor.ts
            └─ knowledgeSuggestionSchema      src/ai/schemas/knowledge-suggestion.ts
       ↳ returns AiSuggestion (unchanged contract)  src/types/ai.ts
```

Rules carried from `src/ai/README.md`:

- Only `src/server/` and `src/ai/services/` call into `src/ai/providers/`.
- Every provider response is validated against an `src/ai/schemas/` schema
  before it reaches application code.
- No provider SDK import outside `src/ai/providers/`.

### `src/ai/` modules added in Phase 4

| File | Exports |
| --- | --- |
| `ai/providers/types.ts` | `interface AiProvider { readonly name: string; generateStructured<T>(opts: { system: string; user: string; schema: JsonSchema; schemaName: string }): Promise<T> }`; `class AiProviderError extends Error` (with `cause`) |
| `ai/providers/anthropic.ts` | `class AnthropicProvider implements AiProvider` — constructs `new Anthropic({ apiKey })`, one `messages.parse()` call, maps `Anthropic.APIError` / parse failure → `AiProviderError` |
| `ai/providers/index.ts` | `getAiProvider(): AiProvider \| null` (null when `serverEnv.aiApiKey` is absent); `isAiConfigured(): boolean` |
| `ai/schemas/knowledge-suggestion.ts` | `knowledgeSuggestionSchema` (Zod discriminated union on `type`); `NOTICE_KEYS` const tuple; `type KnowledgeSuggestion = z.infer<...>`; `toAiSuggestion(parsed): AiSuggestion` mapper |
| `ai/prompts/knowledge-processor.ts` | `KNOWLEDGE_PROCESSOR_PROMPT_V1: string`; `PROMPT_VERSION = "v1"` |
| `ai/services/knowledge-processor.ts` | `structureKnowledge(rawText: string): Promise<StructureResult>` |

### `src/server/` modules added / changed

| File | Change |
| --- | --- |
| `server/actions/ai.ts` | **New.** `structureKnowledgeAction(rawText: unknown): Promise<ActionResult<AiSuggestion>>` |
| `server/actions/schemas.ts` | Add `rawKnowledgeTextSchema = z.string().trim().min(2).max(10_000)` |
| `server/env.ts` | Add `aiApiKey` (optional getter — returns `process.env.AI_API_KEY ?? null`) and `aiModel` (`process.env.AI_MODEL ?? "claude-sonnet-5"`) |

### Client callers that change

| File | Change |
| --- | --- |
| `src/app/(app)/add/page.tsx` | Server Component: call `isAiConfigured()`, pass `aiEnabled` prop to `AddKnowledgeView` |
| `src/features/add/add-knowledge-view.tsx` | Drop the `@/data/mock` import; `runAi` calls `structureKnowledgeAction`; honour `aiEnabled` (hide `AiCaptureBox` + divider when false); map `ai-error` → existing `failed` mode |
| `src/features/add/ai-capture-box.tsx` | Hide the Photo / File attach buttons (paste-text box only) |
| `src/data/mock/index.ts` | Delete both functions. If the file is left empty, remove it and the `@/data/mock` barrel export (pending a grep for other consumers during planning). |

## 4. The schema (`ai/schemas/knowledge-suggestion.ts`)

A Zod **discriminated union on `type`**, one member per authorable type. Field
names match the Add form (`term`, `meaning`, `title`, `readingBody`, `summary`,
`explanation`, `noteBody`, `partOfSpeech`). The model returns typed fields; the
`toAiSuggestion` mapper flattens them into `AiSuggestion.fields`
(`Record<string,string>`) and lifts grammar worked examples into
`AiSuggestion.examples`.

```
NOTICE_KEYS = ["checkTypeAndLevel", "titleAndSummary",
               "summaryAndExamples", "meaningAndType"] as const
```

| `type` | Required fields | Optional fields | Typical `noticeKey` |
| --- | --- | --- | --- |
| `vocabulary` | `term`, `meaning` | `partOfSpeech` | `checkTypeAndLevel`, `meaningAndType` |
| `grammar` | `title`, `explanation` | `summary`, `examples: { nl: string; en?: string }[]` | `summaryAndExamples` |
| `reading` | `title`, `body` | `summary` | `titleAndSummary` |
| `note` | `body` | `title` | — |

Common optional field on every member: `noticeKey?: z.enum(NOTICE_KEYS)`. The
model is told to **leave `level` out entirely** — the reviewer sets it — so
`level` is not in the schema.

`toAiSuggestion` maps:
- `vocabulary` → `fields: { term, meaning, partOfSpeech: partOfSpeech ?? "" }`
- `grammar` → `fields: { title, summary: summary ?? "", explanation }`,
  `examples: examples ?? []`
- `reading` → `fields: { title, readingBody: body, summary: summary ?? "" }`
- `note` → `fields: { title: title ?? "", noteBody: body }`

The result shape stays identical to what the mock returned, so
`add-knowledge-view.tsx`'s `runAi` handler needs no reshaping beyond the call
site.

## 5. The provider (`ai/providers/anthropic.ts`)

- Constructor takes `{ apiKey, model }`. Builds `new Anthropic({ apiKey })`.
- `generateStructured<T>({ system, user, schema, schemaName })`:
  - One non-streaming `client.messages.parse({ model, max_tokens: 4096, system,
    messages: [{ role: "user", content: user }], output_config: { format: … } })`
    with the JSON schema as the response format. The exact `output_config.format`
    shape (and whether `messages.parse()` vs `messages.create()` + manual
    validation is cleaner) is confirmed against the Anthropic TS SDK
    structured-output docs (`claude-api` skill → `typescript/claude-api/tool-use.md`)
    during implementation.
  - Returns the parsed, schema-valid object (`response.parsed as T`).
  - `catch`: `Anthropic.APIError` (rate limit, 5xx, auth), a `refusal`
    stop reason, or a parse/validation failure → throw
    `AiProviderError(message, { cause })`. Never leak the raw SDK error past
    this file.
- `max_tokens: 4096` is ample for a single structured suggestion.
- No streaming, no prompt caching (input is short and varies every call), no
  retries in this slice (a failure surfaces as the "add it manually" panel).

`ai/providers/index.ts`:

```
getAiProvider(): AiProvider | null
  → serverEnv.aiApiKey ? new AnthropicProvider({ apiKey, model: serverEnv.aiModel }) : null

isAiConfigured(): boolean → serverEnv.aiApiKey != null
```

## 6. The service (`ai/services/knowledge-processor.ts`)

```
type StructureResult =
  | { status: "ok"; suggestion: AiSuggestion }
  | { status: "unavailable" }          // no API key configured
  | { status: "error" }                // provider threw / returned unusable output

async function structureKnowledge(rawText: string): Promise<StructureResult>
```

1. `const provider = getAiProvider();` — if `null`, return
   `{ status: "unavailable" }`.
2. Build the user message from `rawText` (trimmed; the caller already
   length-checked, but truncate to 10 000 chars defensively).
3. `const parsed = await provider.generateStructured({ system:
   KNOWLEDGE_PROCESSOR_PROMPT_V1, user, schema: jsonSchema, schemaName:
   "knowledge_suggestion" })` inside a `try`.
4. Run `knowledgeSuggestionSchema.safeParse(parsed)` as a second belt-and-braces
   check (the provider already schema-constrained the output). On failure →
   `{ status: "error" }`.
5. Return `{ status: "ok", suggestion: toAiSuggestion(parsed) }`.
6. Any thrown `AiProviderError` → log server-side, return `{ status: "error" }`.

The JSON Schema handed to the provider is derived from the Zod schema (Zod 4's
`z.toJSONSchema`), computed once at module load.

## 7. The prompt (`ai/prompts/knowledge-processor.ts`)

`KNOWLEDGE_PROCESSOR_PROMPT_V1` — a versioned string const. Content:

- Role: a structuring assistant for a **Dutch-language learning** library.
- The four types and when each applies (a word/phrase → `vocabulary`; a rule or
  pattern → `grammar`; a passage to read → `reading`; anything else → `note`).
- Field conventions: `term` is the Dutch text, `meaning` is the English gloss;
  `partOfSpeech` in English (`"noun"`, `"verb"`, …) or omitted; grammar
  `examples` are `nl` (Dutch) with an optional `en` translation.
- **Do not guess `level`** — omit it; the reviewer sets CEFR level.
- Pick the single most useful `noticeKey` for what the reviewer should
  double-check, or omit it.
- Output must satisfy the provided JSON schema. No prose.

`PROMPT_VERSION = "v1"` is exported so a future prompt revision is an explicit
bump, and logged alongside failures.

## 8. The action (`server/actions/ai.ts`)

```
"use server";

export async function structureKnowledgeAction(
  rawText: unknown,
): Promise<ActionResult<AiSuggestion>> {
  const parsed = rawKnowledgeTextSchema.safeParse(rawText);
  if (!parsed.success) return { ok: false, code: "validation", message: "..." };

  await resolveActiveContext();                 // 401-equivalent if no session
  const result = await structureKnowledge(parsed.data);

  switch (result.status) {
    case "ok":          return { ok: true, data: result.suggestion };
    case "unavailable": return { ok: false, code: "ai-unavailable", message: "..." };
    case "error":       return { ok: false, code: "ai-error", message: "..." };
  }
}
```

No `revalidatePath` — nothing is persisted.

## 9. Client changes (`src/features/add/`)

- **`add/page.tsx`** (Server Component): `const aiEnabled = isAiConfigured();`
  → `<AddKnowledgeView aiEnabled={aiEnabled} />`. `isAiConfigured` is imported
  from `src/ai/providers` and does not touch the SDK.
- **`add-knowledge-view.tsx`**:
  - New prop `aiEnabled?: boolean` (default `false` — safe when the page forgets
    to pass it). When editing an existing item the AI box was already hidden;
    that stays.
  - `runAi`: replace the `window.setTimeout(async …)` sim with
    `const result = await structureKnowledgeAction(rawText)`. On `!result.ok`,
    set `mode = "failed"` (existing `AiFailedPanel`). On success, the existing
    `setType / setValues / setExamples / setNoticeKey / setMode("review")` block
    is unchanged — `result.data` is an `AiSuggestion`.
  - Attachment state (`attachment`, `getAiSuggestionFromAttachment`) is removed
    from this component; `runAi` only ever structures `rawText`.
  - Render: when `!aiEnabled`, skip the `AiCaptureBox` + "or add manually"
    divider — the page is the manual form alone.
  - `source` for a confirmed AI item stays `"ai-assisted"` (the `"photo"` /
    `"file-upload"` branches in `handleSubmit` go away with the attachment
    state).
- **`ai-capture-box.tsx`**: remove the Photo / File `<button>`s and the hidden
  `<input type="file">`; keep the textarea, char affordance, and the "Structure
  with AI" submit. `classifyAttachment` and the `AiAttachment` type stay in
  `src/features/add/types.ts` for the later multimodal slice but are no longer
  imported here.
- **`ai-failed-panel.tsx`**, **`ai-review-banner.tsx`**: unchanged.

### i18n

- No new keys required. `add.ai.notice.*` keeps all 7 entries (the 3
  attachment ones — `fromPhoto` / `fromPdf` / `fromDocument` — are simply
  unused now; removing them is a trivial cleanup left for the multimodal slice
  so its diff stays coherent).
- `add.ai.disclaimer` currently ends "Simulated for now." — drop that sentence
  (EN + NL).

## 10. Environment & dependencies

- **Dependency:** `@anthropic-ai/sdk` (add to `dependencies`).
- **`.env.example`:** replace the commented `AI_*` block with real (blank) keys:
  ```
  # --- AI (Backend Phase 4) ---
  # Anthropic API key. Optional — when absent, the Add screen's AI capture
  # box is hidden and only the manual form shows. CI runs without it.
  AI_API_KEY=
  # Optional model override; defaults to claude-sonnet-5.
  AI_MODEL=
  ```
- **`.env.local`:** the owner adds a real `AI_API_KEY` (same out-of-band step as
  the Supabase SMTP setup in Phase 1's follow-up). Not committed.
- **`src/server/env.ts`:** `aiApiKey` uses a nullable pattern, **not**
  `required()`; `aiModel` has the `claude-sonnet-5` default.

## 11. Testing (Vitest — matches Phase 2/3)

| File | Covers |
| --- | --- |
| `ai/schemas/knowledge-suggestion.test.ts` | `toAiSuggestion` maps each of the 4 types to the exact `AiSuggestion.fields` shape the form expects; grammar `examples` lifted; an out-of-set `noticeKey` and a missing required field are rejected by `safeParse` |
| `ai/services/knowledge-processor.test.ts` | With a **fake `AiProvider`** returning canned structured objects: `status: "ok"` + correct suggestion per type; provider throws → `status: "error"`; provider returns schema-invalid object → `status: "error"`; `getAiProvider()` null → `status: "unavailable"` (via env stub) |
| `ai/providers/anthropic.test.ts` | `@anthropic-ai/sdk` mocked: `generateStructured` calls `messages.parse` with the schema + `schemaName` and returns `.parsed`; an `Anthropic.APIError` and a `refusal` stop reason are re-thrown as `AiProviderError` |
| `server/actions/ai.test.ts` | `rawKnowledgeTextSchema` rejects `""`, `" "`, a 1-char string, and a 10 001-char string; accepts a normal paste; `ai-unavailable` surfaces when the provider is null |
| `features/add/add-knowledge-view.test.tsx` (extend existing if present) | `aiEnabled={false}` → no `AiCaptureBox` in the tree; `aiEnabled` + a mocked `structureKnowledgeAction` rejection → `AiFailedPanel` renders |

**No live API call in CI.** The provider is always faked or the SDK mocked, the
same way the DB integration suites skip without `TEST_DATABASE_URL`. A short
note goes in the test file header.

## 12. Out of scope for Phase 4

- **Attachments / multimodal** — photo, PDF, and text-file capture. The
  buttons are hidden this phase; the next AI slice sends real file bytes to the
  model (and interacts with the still-deferred Supabase Storage work).
- **Other AI services** — `Explainer`, `PracticeGenerator` / `ExamGenerator`
  (they stay the deterministic algorithms in `practice-service.ts`),
  `AnswerEvaluator`.
- **Embeddings / pgvector** — the `vector` extension stays enabled and unused.
- **Rate limiting, per-user quotas, monthly spend ceiling** — length cap only.
- **Streaming, prompt caching, retries/backoff** — not needed for one short
  structured call; a failure is a visible "add it manually".
- **Prompt A/B testing or a prompt registry** — a single versioned const.
- **`src/data/mock/` beyond these two functions** — nothing else there to
  remove; the file/barrel deletion is contingent on the planning grep.

## 13. Rollout notes

- Ships behind the key: merged with no `AI_API_KEY` in an environment, the
  feature is invisible and the manual form is unaffected. The owner sets the key
  on Vercel (Preview + Production) and in `.env.local` when ready to switch it
  on — no redeploy of code required, only the env var.
- First manual check once the key is set: paste a word pair, a rule, a
  paragraph, and a single word; confirm each lands in the right type with
  sensible fields and the `level` left blank; confirm a confirmed item saves
  with `source: "ai-assisted"`.
- Reversible: unset the key (feature hides) or revert the branch.
