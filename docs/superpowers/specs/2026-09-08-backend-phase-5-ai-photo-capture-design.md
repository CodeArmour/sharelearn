# Backend Phase 5 — AI Photo Capture

**Date:** 2026-09-08
**Status:** Implemented — branch worktree-backend-phase-5-ai-photo-capture (Supabase bucket + RLS + CRON_SECRET owner setup pending; manual smoke pending)
**Scope:** Add a third input mode to the Add-knowledge screen's AI-capture
step: **Upload photos**. A person picks 1–3 photos, the AI reads them together
and returns a *set* of typed knowledge drafts (`vocabulary` / `grammar` /
`reading` / `note`), each with its per-type fields filled. The reviewer confirms
the set on a new checklist screen and bulk-inserts what they keep. Photos are
transient — staged in Supabase Storage for the duration of the call, then
deleted. **No summary of the upload is produced or stored** — the output is the
item set and nothing else.

**Photos only. No PDF, no document/text files, no audio. No permanent
attachments — nothing links a saved knowledge item back to its source image.**

---

## 1. Context

Backend Phase 4 (merged, plus PRs #12–#14) stood up `src/ai/` end-to-end:
`providers → schemas → prompts → services`, a real OpenAI provider, and
`structureKnowledge(rawText)` behind `structureKnowledgeAction`. The
Add-knowledge screen's AI-capture step (`src/features/add/ai-capture-box.tsx`)
is currently **paste-text only** — the Photo / File buttons were explicitly
hidden in Phase 4 with a note that "the next AI slice sends real file bytes to
the model (and interacts with the still-deferred Supabase Storage work)." This
is that slice.

Supabase Storage has not been used before in this project. This phase
introduces the first bucket.

### What Phase 5 adds

| Today | After Phase 5 |
| --- | --- |
| AI-capture step: one input, a textarea → `structureKnowledgeAction(rawText)` → **one** `AiSuggestion` → pre-filled Add form | A mode toggle: **Paste text** (unchanged) / **Upload photos**. The photo path → `extractFromPhotosAction(paths)` → **`{ items: AiSuggestion[] }`** → a review **checklist** → bulk insert |
| `structureKnowledge` returns a single discriminated-union member — one type, one item | `extractKnowledgeFromImages` returns `{ items[] }`; each item is the **same** union member Phase 4 already defines, with the **same per-type fields** filled. Mixed types and repeated items (10 vocab words) are the normal case |
| No file storage anywhere | One Supabase Storage bucket, `knowledge-capture-staging`, per-user prefix, RLS-scoped, swept |
| `AiProvider.generateStructured({ system, user, schema })` — text in | Same method gains an optional `images` field — image parts in |

### The problem this phase answers

A single photo of a worksheet legitimately contains a whole vocab list, or a
grammar rule *plus* the new words that illustrate it. Phase 4's "one call → one
suggestion → one form" model throws away everything but the dominant item. The
fix is to make the extraction return a **set**, and to give the reviewer a
screen built for confirming a set rather than filling N forms.

## 2. Decisions locked before design

| Decision | Choice | Rationale |
| --- | --- | --- |
| Input types | **Photos only** — JPEG, PNG, WebP, HEIC. No PDF, no `.txt`/`.docx`, no audio. | Keeps this to a single vision call with no page-splitting / merge / de-dupe-across-pages machinery. PDF is a clean follow-up slice once the set-extraction + review plumbing exists. |
| Images per request | **1–3.** | Enough for "the front and back of a worksheet" without letting one call balloon. |
| Size ceiling | Each file ≤ **10 MB** before downscaling; rejected client-side before upload. | Matches a phone photo; bounds the upload. |
| Client-side downscaling | Every image is redrawn to **≤ 1600 px on the long edge, JPEG q≈0.82** in the browser before upload. | A vision model reads worksheet text fine at ~1600 px. Turns 3 × 8 MB into 3 × ~400 KB — sidesteps the Next.js Server Action body limit, cuts token cost, speeds the upload. |
| Storage lifetime | **Transient.** Staged in `knowledge-capture-staging`, deleted on every exit path (success, extraction failure, user abandons). A scheduled sweep deletes anything older than 1 hour as a backstop. | "Supabase storage" here means a staging area, not a source-of-truth artifact. No `sources` table, no back-links, no storage RLS surface beyond the staging bucket. |
| Extraction shape | One call across all 1–3 images → `{ items: KnowledgeSuggestion[] }`, `items` capped at **30**. **No summary field.** | One call keeps latency and cost predictable; 3 downscaled images fit comfortably. 30 is the point past which the review screen stops being reviewable. A summary was considered and cut — the output is the item set. |
| Per-item schema | **Reuse `knowledgeSuggestionSchema` and `toAiSuggestion` unchanged.** New wrapper `knowledgeExtractionSchema = { items: array(union).min(1).max(30) }`. | The union already models all four types with the exact field names the Add form wants, including the full per-type field set (§5). Phase 5 only adds the envelope. |
| Review UX | A **checklist screen**: one row per item (type badge + key fields), all checked by default, inline quick-edit, "expand" opens the full Phase 4 Add form for that row, one "Add N selected" button. | Keeps Phase 4's human-confirmation gate without making anyone fill 10 forms. |
| Invalid rows | Items that fail `knowledgeSuggestionSchema` are dropped before the screen renders. If **every** item fails (or `items` is empty), fall back to the manual Add form exactly as Phase 4 does on `error`. | Partial extraction is still useful; a total miss behaves like today. |
| Bulk insert | New `createKnowledgeItemsAction(inputs[])` → all selected rows in **one DB transaction**, all-or-nothing. | A half-inserted batch with no clear "which ones" is worse than a retry. |
| Entry point | A **third mode on the same AI-capture step**, toggled "Paste text" / "Upload photos". Same review flow feeds the same Add form. | Same job — feed the AI, confirm what it found — different input. No new route. |
| Rate limiting / quotas | **None in this slice**, consistent with Phase 4. The 3-image cap + downscaling + 30-item cap are the cost guards. | Invite-gating limits who can call this. A per-user daily cap is a noted follow-up, not this phase. |
| Missing API key | Same graceful degradation as Phase 4. No `AI_API_KEY` → the whole AI-capture step is already hidden; the photo mode simply doesn't exist either. | A fresh clone / CI runs with no key and no Storage bucket configured for AI. |
| `source` of saved items | `"ai-assisted"`, same as the text path. | These are AI-drafted, reviewer-confirmed items — the existing value already means exactly that. |

## 3. Architecture & layering

```
add-knowledge-view.tsx (client)
  ├─ mode toggle: "text" | "photos"
  │
  └─ photos mode
       ├─ downscaleImage(file)                 src/features/add/downscale-image.ts   (client)
       ├─ createBrowserSupabaseClient()        src/lib/supabase/browser.ts           (NEW — first client-side Supabase use)
       ├─ upload to Storage (user session)     bucket: knowledge-capture-staging
       │     path: {userId}/{uuid}.jpg
       ├─ extractFromPhotosAction(paths)        src/server/actions/ai.ts
       │    └─ extractKnowledgeFromImages(imgs) src/ai/services/knowledge-extractor.ts
       │         ├─ getAiProvider()             src/ai/providers/index.ts
       │         │    └─ OpenAIProvider         src/ai/providers/openai.ts  ──►  openai
       │         ├─ KNOWLEDGE_EXTRACTION_PROMPT src/ai/prompts/knowledge-extractor.ts
       │         ├─ knowledgeExtractionSchema   src/ai/schemas/knowledge-suggestion.ts
       │         └─ ensureGrammarExamples(...)  (reused, per grammar item)
       │    ↳ returns { items: AiSuggestion[] }
       ├─ delete staged objects (user session) always — success or failure
       │
       └─ review checklist → createKnowledgeItemsAction(selected)  src/server/actions/knowledge.ts
                                  └─ createKnowledgeItems(inputs)  src/server/services/knowledge-service.ts
                                       └─ db.transaction → insertKnowledgeItem per row  (all-or-nothing)

/api/cron/sweep-capture-staging          src/app/api/cron/sweep-capture-staging/route.ts
  └─ admin client: delete knowledge-capture-staging objects older than 1h
```

Rules carried from `src/ai/README.md` (unchanged):

- Only `src/server/` and `src/ai/services/` call into `src/ai/providers/`.
- Every provider response is validated against an `src/ai/schemas/` schema
  before it reaches application code.
- No provider SDK import outside `src/ai/providers/`.

## 4. Supabase Storage

### Bucket

| Property | Value |
| --- | --- |
| Name | `knowledge-capture-staging` |
| Public | **No** — private bucket, accessed via the user's session (RLS) or the service role |
| Path convention | `{auth.uid()}/{uuid}.jpg` — always one user-id segment, then a random file |
| Allowed MIME (bucket config) | `image/jpeg` (everything is re-encoded to JPEG client-side before upload) |
| File size limit (bucket config) | 2 MB — a downscaled 1600 px JPEG is well under this; a raw photo would be rejected, which is a useful backstop if downscaling is bypassed |

### RLS policies (on `storage.objects`, `bucket_id = 'knowledge-capture-staging'`)

A person may only touch files under their own id prefix:

```sql
-- SELECT, INSERT, DELETE — same predicate
(storage.foldername(name))[1] = auth.uid()::text
```

No UPDATE policy (files are write-once then deleted). The scheduled sweep uses
the **service-role** client and bypasses RLS.

### Lifecycle

1. Client uploads each downscaled image with a **user-session browser**
   Supabase client → gets back `{ path }`. This is the project's first
   client-side Supabase use — add `src/lib/supabase/browser.ts` exporting
   `createBrowserSupabaseClient()` (thin `@supabase/ssr` `createBrowserClient`
   wrapper reading the same `NEXT_PUBLIC_SUPABASE_*` env the server helper
   uses). The `@supabase/ssr` cookie session is shared, so RLS applies as the
   signed-in user with no extra auth wiring.
2. Client calls `extractFromPhotosAction(paths)`.
3. The action, using the **user-session** server client, creates a **60-second
   signed URL** per path (`createSignedUrl`) and passes the URLs to the AI
   service as `image_url` parts.
4. `finally` in the action: delete every `path` (`.remove(paths)`), best-effort,
   with the user-session client. A failure here is logged, not surfaced —
   the sweep is the backstop.
5. If the client never reaches step 2 (user closes the tab after upload), the
   objects are orphaned until the sweep.

### Scheduled sweep

`src/app/api/cron/sweep-capture-staging/route.ts` — a `GET` route:

- Rejects unless `Authorization: Bearer ${CRON_SECRET}` matches (Vercel Cron
  sends this header).
- Admin client: list `knowledge-capture-staging`, delete every object with
  `created_at` older than 1 hour.
- Registered in `vercel.json` `crons` at `0 * * * *` (hourly).

New env var: `CRON_SECRET` (required in production; the route 503s if unset so a
misconfigured deploy fails loud).

## 5. AI layer changes

### `src/ai/providers/` — image input

`AiProvider.generateStructured` gains one optional field:

```ts
generateStructured<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  images?: { url: string }[];   // NEW — signed URLs, sent as input_image parts
}): Promise<T>;
```

`OpenAIProvider`: when `images` is present, `input` becomes the structured
content-parts form:

```ts
input: [{
  role: "user",
  content: [
    { type: "input_text", text: user },
    ...images.map((i) => ({ type: "input_image", image_url: i.url })),
  ],
}]
```

Everything else — `instructions: system`, `reasoning.effort`, the
`buildTextFormat` structured-output wrapper, the primary → fallback model
retry, `AiProviderError` mapping — is unchanged. `max_output_tokens` rises to
**32000** (a 30-item set of vocab rows with grammatical extras is much larger
than one suggestion). The `buildTextFormat` schema name becomes a parameter
rather than the hard-coded `"knowledge_suggestion"`.

### `src/ai/schemas/knowledge-suggestion.ts` — the envelope

Add, alongside the untouched `knowledgeSuggestionSchema` /
`grammarExamplesResultSchema` / `toAiSuggestion`:

```ts
export const knowledgeExtractionSchema = z.object({
  items: z.array(knowledgeSuggestionSchema).min(1).max(30),
});
export type KnowledgeExtraction = z.infer<typeof knowledgeExtractionSchema>;
```

**No `summary` field.** No change to the union, `NOTICE_KEYS`, `shared`, or
`toAiSuggestion`. The service maps `toAiSuggestion` over `items`.

### Per-type fields the extractor fills

Each `items[]` entry is one member of the existing Phase 4 union — the
extractor fills the **same fields the paste-text path fills** (schema in
`knowledge-suggestion.ts`, guidance from `KNOWLEDGE_PROCESSOR_PROMPT_V2`). No
field is added or removed for Phase 5; the photo prompt just has to produce
them from an image instead of pasted text.

| Type | Required | Also filled when they apply | Shared (every type) |
| --- | --- | --- | --- |
| `vocabulary` | `term` (Dutch, verbatim), `meaning` (English gloss) | `partOfSpeech` (English); `article` `"de"`/`"het"` (nouns); `plural` (nouns); `pastTense`, `perfect` (verbs); `example` (short Dutch sentence), `exampleTranslation`; `usageNote` (register / common mistake / collocation) | `level` (proposed CEFR A1–C2, reviewer confirms), `tags` (0–4 short lowercase), `noticeKey` (optional, from the closed set) |
| `grammar` | `title` (short English name), `explanation` (English prose only — **no example sentences in here**) | `summary` (one English sentence); `examples` — 2–4 `{ nl, en }` demonstrating the rule, **required unless the rule genuinely can't be shown in a sentence**; the `ensureGrammarExamples` follow-up backfills when empty | same |
| `reading` | `title`, `body` (the passage **verbatim** — never translate/edit) | `summary` (1–2 English sentences) | same |
| `note` | `body` (the text, learner's wording kept) | `title` (short label) | same |

Notes carried from Phase 4 and unchanged here:
- `term` is always Dutch, `meaning` always English.
- A `reading` `body` and a `note` `body` are never rewritten or translated.
- For `vocabulary`, conjugations / plurals / articles that aren't standard
  Dutch are **omitted**, not guessed.
- Per-item `level` **is** proposed (Phase 4 PR #12/#13 reversed the earlier
  "never guess level" rule — the extractor follows the current prompt).

### `src/ai/prompts/knowledge-extractor.ts` — new, versioned

`KNOWLEDGE_EXTRACTION_PROMPT` + `EXTRACTION_PROMPT_VERSION = "v1"`. It reuses the
**per-type field guidance from `KNOWLEDGE_PROCESSOR_PROMPT_V2` almost verbatim**
(the four type blocks, the "fill every field that genuinely applies / omit
rather than invent" rule, the shared `level` / `tags` / `noticeKey` block, the
Dutch-vs-English and don't-rewrite-bodies rules) — the only real change is the
input and the fact that it returns a list. Content:

- Role: extract study material from **photos** for a Dutch-language learning
  app. The images may be a worksheet, textbook page, whiteboard, or handwritten
  notes.
- Read **all** provided images as one source. If the same word/rule appears in
  more than one image, emit it **once**.
- Produce `items`: for **each distinct thing to learn** in the photos, one
  entry of the right type with **every applicable per-type field filled** (the
  table in §5 — same fields as the paste-text path):
  - a single word/phrase → one `vocabulary` item (10 words on a list = 10
    items), with `partOfSpeech` / `article` / `plural` / `pastTense` /
    `perfect` / `example` + `exampleTranslation` / `usageNote` where they apply;
  - a rule or pattern → `grammar`, with `explanation` in English prose and
    `examples` as 2–4 `{ nl, en }` sentences (never put sentences in
    `explanation`);
  - a passage to read → `reading`, `body` verbatim;
  - anything else → `note`.
- Every item also gets a proposed `level` (CEFR A1–C2), 0–4 `tags`, and
  optionally one `noticeKey` from the closed set.
- **No summary of the upload** — do not describe the photos; only return items.
- Hard cap: at most 30 items. If the photos contain more, return the 30 most
  useful and nothing else.
- Output must satisfy the provided JSON schema. No prose outside it.

### `src/ai/services/knowledge-extractor.ts` — new

```ts
export type ExtractResult =
  | { status: "ok"; items: AiSuggestion[]; truncated: boolean }
  | { status: "unavailable" }
  | { status: "error" };

export async function extractKnowledgeFromImages(
  images: { url: string }[],
): Promise<ExtractResult>;
```

1. `getAiProvider()` → `null` ⇒ `{ status: "unavailable" }`.
2. Guard `images.length` to 1–3 defensively (the action already checked).
3. `provider.generateStructured({ system: KNOWLEDGE_EXTRACTION_PROMPT,
   user: "<see below>", schema: knowledgeExtractionSchema, images })` inside a
   `try`.
   - `user` text: a short instruction line, e.g. `"Extract every distinct
     study item from the ${n} attached image(s), with all per-type fields."`
4. `knowledgeExtractionSchema.safeParse(raw)` — belt-and-braces. On failure ⇒
   `{ status: "error" }` (logged with `EXTRACTION_PROMPT_VERSION`).
5. `items = parsed.items.map(toAiSuggestion)`.
6. For each grammar item with no examples, run the existing
   `ensureGrammarExamples(provider, item)` — **best-effort, sequential, and
   only for the first 3 grammar items** so a set with many rules can't fan out
   into a dozen slow follow-up calls. (Lift `ensureGrammarExamples` to a shared
   helper module — `src/ai/services/grammar-examples.ts` — imported by both
   `knowledge-processor.ts` and `knowledge-extractor.ts`.)
7. Return `{ status: "ok", items, truncated: parsed.items.length === 30 }`.
8. Any `AiProviderError` / unexpected throw ⇒ log, `{ status: "error" }`.

`src/ai/README.md`: update the services row — `knowledge-extractor` implemented;
note the shared `grammar-examples` helper.

## 6. Server actions

### `src/server/actions/ai.ts` — add `extractFromPhotosAction`

```ts
export async function extractFromPhotosAction(
  paths: unknown,
): Promise<ActionResult<{ items: AiSuggestion[]; truncated: boolean }>> {
  const parsed = capturePathsSchema.safeParse(paths);   // 1–3 strings, each "{uuid}/{uuid}.jpg" ({userId}/{file})
  if (!parsed.success) return { ok: false, code: "validation", message: "..." };

  const ctx = await resolveActiveContext();              // session required
  const supabase = await createServerSupabaseClient();

  // every path must be under this user's own prefix — defence in depth over RLS
  if (parsed.data.some((p) => !p.startsWith(`${ctx.userId}/`))) {
    return { ok: false, code: "validation", message: "..." };
  }

  try {
    const signed = await Promise.all(
      parsed.data.map((p) =>
        supabase.storage.from(BUCKET).createSignedUrl(p, 60).then((r) => {
          if (r.error || !r.data) throw new Error(r.error?.message ?? "sign failed");
          return { url: r.data.signedUrl };
        }),
      ),
    );
    const result = await extractKnowledgeFromImages(signed);
    switch (result.status) {
      case "ok":          return { ok: true, data: { items: result.items, truncated: result.truncated } };
      case "unavailable": return { ok: false, code: "ai-unavailable", message: "..." };
      case "error":       return { ok: false, code: "ai-error", message: "..." };
    }
  } finally {
    void supabase.storage.from(BUCKET).remove(parsed.data).catch(() => {});
  }
}
```

`capturePathsSchema` goes in `server/actions/schemas.ts`:
`z.array(z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+\.jpg$/)).min(1).max(3)`.

No `revalidatePath` — nothing persisted here.

### `createKnowledgeItemsAction` + `createKnowledgeItems` (batch)

The single-item path today is
`createKnowledgeItemAction` (`src/server/actions/knowledge.ts`) →
`createKnowledgeItem` (`src/server/services/knowledge-service.ts`, which already
opens a `db.transaction` and calls the repo's `insertKnowledgeItem` once). The
batch mirrors it one layer at a time — no new repository function.

**Action** — `src/server/actions/knowledge.ts`:

```ts
export async function createKnowledgeItemsAction(
  inputs: unknown,
): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = z.array(createKnowledgeItemSchema).min(1).max(30).safeParse(inputs);
  if (!parsed.success) return { ok: false, code: "validation", message: "..." };
  try {
    const items = await createKnowledgeItems(parsed.data);
    revalidatePath("/knowledge");
    return { ok: true, data: { ids: items.map((i) => i.id) } };
  } catch (e) {
    return toActionError(e);   // same mapper createKnowledgeItemAction uses
  }
}
```

**Service** — `src/server/services/knowledge-service.ts`, alongside
`createKnowledgeItem`:

```ts
export async function createKnowledgeItems(
  inputs: CreateKnowledgeItemInput[],
): Promise<KnowledgeItem[]> {
  const { groupId, userId } = await requireActiveGroupId();
  return db.transaction((tx) => {
    const dbtx = tx as unknown as Db;
    const out: KnowledgeItem[] = [];
    for (const input of inputs) {
      out.push(insertKnowledgeItem(dbtx, buildKnowledgeRow({ groupId, userId }, input)));
    }
    return Promise.all(out);
  });
}
```

`buildKnowledgeRow(shared, input)` is the per-type `switch` currently inline in
`createKnowledgeItem` (vocabulary / grammar / reading-with-`wordCount` / note),
**extracted** so single and batch cannot drift. `createKnowledgeItem` is
refactored to call it too. On any row throwing, the `db.transaction` rolls back
the whole batch and the action returns `code: "error"` — nothing inserted.

## 7. Client — `src/features/add/`

### `downscale-image.ts` (new, client util)

`async function downscaleImage(file: File): Promise<Blob>` —
`createImageBitmap(file)` → `OffscreenCanvas` (or a detached `<canvas>`) sized so
the long edge ≤ 1600 px → `canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 })`.
Rejects with a typed error if the browser can't decode the file (the practical
case: HEIC outside Safari — see §10). Pure function, unit-tested with a small
fixture.

### `ai-capture-box.tsx`

- Add a two-option segmented control at the top: **Paste text** | **Upload
  photos** (`add.ai.mode.text` / `add.ai.mode.photos`). Default: text.
- **Photos panel**: a file input (`accept="image/*"`, `multiple`, capped at 3),
  a thumbnail strip with per-image remove, a "Structure with AI" button. Shows
  per-file state: downscaling → uploading → done / rejected.
- The view needs the signed-in user's id for the upload path. Pass it as a prop
  from the Server Component page (it already resolves context), rather than
  fetching it client-side.
- Photo submit flow (in the view, not the box):
  1. For each file: `downscaleImage` → `createBrowserSupabaseClient()
     .storage.from(BUCKET).upload(\`${userId}/${crypto.randomUUID()}.jpg\`, blob,
     { contentType: "image/jpeg" })`.
  2. `extractFromPhotosAction(paths)`.
  3. On `ok` → go to **review checklist** (new mode). On `!ok` → the existing
     `AiFailedPanel` (`ai-error` / `ai-unavailable` map to it as today).
- The text panel is exactly today's textarea path — untouched.

### `add-knowledge-view.tsx` — new `"review-list"` mode

State machine gains one mode between `loading` and `review`:

- `mode = "review-list"` holds `{ truncated, rows: ReviewRow[] }` where
  `ReviewRow = { id: string; checked: boolean; suggestion: AiSuggestion }`.
- Renders `<ReviewChecklist>` (new component, §8).
- "Add N selected" → build `CreateKnowledgeItemInput[]` from the checked rows
  (the same mapping `handleSubmit` does for a single confirmed item, factored
  into a helper) → `createKnowledgeItemsAction(inputs)` → on `ok`, the existing
  `SuccessPanel` with a count ("7 items added"); on `!ok`, stay on the list
  with an inline error and a retry.
- "Edit" on a row → load that row's `suggestion` into the normal single-item
  form (`type` + `values` + `examples` + `noticeKey`), in a new
  `mode = "review"` sub-state that, on save, writes back into the row rather
  than inserting — then returns to `"review-list"`.
- Abandoning the screen (nav away) does not need cleanup — the staged objects
  are already deleted by the action's `finally`.

### `ai-review-banner.tsx`

Reused above the checklist. No summary line. When `truncated`, it shows
`add.ai.photos.truncated` ("Some items may be missing — upload a smaller
section for the rest"); otherwise it's the existing "review before saving"
reminder.

## 8. `ReviewChecklist` component (new)

`src/features/add/review-checklist.tsx`, client.

```
props: {
  truncated: boolean;
  rows: ReviewRow[];
  onToggle(id): void;
  onToggleAll(checked): void;
  onEdit(id): void;
  onRemove(id): void;
  onSubmit(): void;          // "Add N selected"
  submitting: boolean;
}
```

- Header: "select all / none" + live "N selected". No summary.
- Each row: a checkbox, a **type badge** (`vocabulary` / `grammar` / `reading` /
  `note` — reuse the badge/label from the knowledge list if one exists), and a
  one-line preview built from that row's own fields:
  - vocabulary → `term — meaning` (＋ a small muted count of extra fields filled,
    e.g. "+article, plural, example", so the reviewer can see the AI populated
    them without expanding)
  - grammar → `title` (＋ "N examples")
  - reading → `title`
  - note → `title || first ~60 chars of body`
- Row actions: **Edit** (opens the full form with **every** per-type field the
  AI filled), **Remove** (drops the row entirely).
- No inline field editing in v1 beyond check/remove — "Edit" is the escape
  hatch. (Inline editing of `term`/`meaning` is a noted nicety, not in scope.)
- Footer: **Add N selected** (disabled when 0 checked or `submitting`).

Purely presentational; all state lives in `add-knowledge-view.tsx`.

## 9. i18n (`src/messages/{en,nl}.json`)

New keys under `add.ai`:

| Key | EN (draft) |
| --- | --- |
| `mode.text` | "Paste text" |
| `mode.photos` | "Upload photos" |
| `photos.pick` | "Choose photos (up to 3)" |
| `photos.hint` | "A worksheet, textbook page, or your notes. JPEG or PNG." |
| `photos.downscaling` | "Preparing…" |
| `photos.uploading` | "Uploading…" |
| `photos.rejectedFormat` | "Couldn't read this image. Try a JPEG or PNG." |
| `photos.rejectedSize` | "That image is over 10 MB." |
| `photos.tooMany` | "Up to 3 photos at a time." |
| `photos.submit` | "Structure with AI" |
| `photos.truncated` | "Some items may be missing — upload a smaller section for the rest." |
| `review.title` | "Review what the AI found" |
| `review.extraFields` | "+{fields}" |
| `review.exampleCount` | "{count} examples" |
| `review.selectAll` | "Select all" |
| `review.selected` | "{count} selected" |
| `review.edit` | "Edit" |
| `review.remove` | "Remove" |
| `review.submit` | "Add {count} selected" |
| `review.empty` | "Nothing selected" |
| `review.successCount` | "{count} items added" |
| `review.failed` | "Couldn't save the items. Try again." |

No new `notice.*` keys — the per-item `noticeKey` set is unchanged.

## 10. Known limitations & follow-ups

- **HEIC outside Safari.** `image/*` pickers accept HEIC and iOS Safari decodes
  it in a canvas, but Chrome/Firefox on desktop do not. `downscaleImage` rejects
  with `photos.rejectedFormat` in that case. If this bites real users, add
  `heic2any` (client, lazy-imported only when the file is HEIC) — noted, not in
  this phase.
- **No per-user quota / daily cap.** Consistent with Phase 4. The 3-image ×
  ~1600 px × 30-item ceilings bound a single call; a spend cap across calls is a
  later infra slice.
- **PDF.** The set-extraction + review plumbing this phase builds is exactly
  what PDF needs; adding it later is a new prompt + a page-render step +
  merge/de-dupe across pages.
- **Inline row editing** in the checklist (edit `term`/`meaning` without
  opening the full form).
- **Source images are not kept.** If "show me the original" ever matters, that's
  the `sources`-table design we deliberately skipped here.

## 11. Environment & dependencies

- **No new npm dependency** for the core path (`OffscreenCanvas` + Storage are
  built-in / already-present). `heic2any` only if §10 forces it.
- **New env var:** `CRON_SECRET` — required in production; the sweep route 503s
  when unset.
- **`.env.example`:** add
  ```
  # --- Cron (Backend Phase 5) ---
  # Shared secret Vercel Cron sends as `Authorization: Bearer …`. Required in
  # production; the staging-bucket sweep route refuses to run without it.
  CRON_SECRET=
  ```
- **`src/server/env.ts`:** add `cronSecret` (required getter).
- **`vercel.json`:** add
  ```json
  { "crons": [{ "path": "/api/cron/sweep-capture-staging", "schedule": "0 * * * *" }] }
  ```
- **Supabase setup (owner, out of band):** create the private
  `knowledge-capture-staging` bucket (2 MB limit, `image/jpeg` only) and apply
  the three RLS policies in §4. Same class of manual step as the Phase 1 SMTP
  setup. Document it in the repo's Supabase setup notes.

## 12. Testing (Vitest)

| File | Covers |
| --- | --- |
| `src/ai/schemas/knowledge-suggestion.test.ts` (extend) | `knowledgeExtractionSchema`: accepts a mixed 8-item set; enforces `items.max(30)` and `.min(1)`; rejects a set with one malformed member; has **no** `summary` key; a vocabulary item with the full grammatical extras and a grammar item with `examples` both parse |
| `src/ai/services/knowledge-extractor.test.ts` (new) | Fake `AiProvider`: happy path (mixed items, per-type fields preserved through `toAiSuggestion`) → `ok` with mapped `AiSuggestion[]`; `items` length 30 → `truncated: true`; provider throws → `error`; schema-invalid envelope → `error`; `getAiProvider()` null → `unavailable`; grammar-examples follow-up runs for ≤ 3 grammar items only |
| `src/ai/services/grammar-examples.test.ts` (new, moved from processor test) | The lifted helper still behaves as in Phase 4 |
| `src/ai/providers/openai.test.ts` (extend) | `generateStructured` with `images` builds the content-parts `input` with one `input_image` per URL; text-only path unchanged; `max_output_tokens` bump asserted |
| `src/server/actions/ai.test.ts` (extend) | `capturePathsSchema` rejects 0 paths, 4 paths, a path outside the caller's prefix, a non-`.jpg`; `finally` calls `storage.remove` on both the `ok` and `error` branch (mocked storage); `ai-unavailable` surfaces with no provider |
| `src/server/actions/knowledge.test.ts` (extend) | `createKnowledgeItemsAction`: rejects an empty array and > 30; a mixed valid batch returns `ids` of the right length; a thrown service error maps to `code: "error"` |
| `src/server/services/knowledge-service.test.ts` (extend) | `createKnowledgeItems` calls `insertKnowledgeItem` once per input inside one `db.transaction`; `buildKnowledgeRow` maps each of the 4 types (reading gets `wordCount`); one row throwing rejects the whole call (transaction rolls back); `createKnowledgeItem` still passes after the `buildKnowledgeRow` extraction |
| `src/features/add/downscale-image.test.ts` (new) | A > 1600 px fixture comes back ≤ 1600 px on the long edge and `type === "image/jpeg"`; an undecodable blob rejects with the typed error |
| `src/features/add/review-checklist.test.tsx` (new) | Renders one row per item with the right badge + preview per type (vocab shows `term — meaning` + extra-field hint, grammar shows the example count); toggle / toggle-all / remove update the count; "Add N selected" disabled at 0; fires `onSubmit`; `truncated` shows the notice |
| `src/features/add/add-knowledge-view.test.tsx` (extend) | Photos mode + mocked `extractFromPhotosAction` → `review-list` renders; "Edit" round-trips a row through the form and back; "Add N selected" + mocked `createKnowledgeItemsAction` → `SuccessPanel` with the count; action rejection → inline error, still on the list |
| `src/app/api/cron/sweep-capture-staging/route.test.ts` (new) | 401 without the bearer secret; 503 when `CRON_SECRET` unset; with a mocked admin client, deletes only objects older than 1h |

**No live API call and no live Storage call in CI** — the provider is faked and
the Supabase client mocked, the same way the DB integration suites skip without
`TEST_DATABASE_URL`. The RLS policies get exercised in the existing
`rls.integration.test.ts` style suite if/when a Storage integration test is
added (noted, not required for merge).

## 13. Out of scope for Phase 5

- PDF, document files, audio, any non-image input.
- Permanent storage of source images; a `sources` table; "view original".
- Per-user quotas, daily caps, spend ceilings, rate limiting.
- Inline field editing in the review checklist.
- Streaming, prompt caching, retries beyond the existing primary → fallback
  model swap.
- Multi-call / per-region extraction for very dense pages — one call, 30-item
  cap, "upload a smaller section" is the answer.
- `heic2any` (added only if desktop HEIC turns out to matter).
- Prompt A/B testing or a prompt registry — one versioned const, as Phase 4.

## 14. Rollout notes

- Ships behind the same `AI_API_KEY` gate as Phase 4 — no key, no AI-capture
  step at all, so no photo mode. The bucket + cron can be created ahead of the
  key with zero user-visible effect.
- `CRON_SECRET` must be set on Vercel (Production) before the cron is enabled,
  or the route 503s (harmless — it just doesn't sweep).
- First manual check once live: photograph a worksheet with a vocab list + one
  grammar rule; confirm the checklist shows one row per word plus a grammar
  row, types correct, `level` blank; deselect one, edit one, "Add N selected";
  confirm the right count lands in the knowledge list with `source:
  "ai-assisted"`; confirm the staged objects are gone from the bucket.
- Reversible: unset `AI_API_KEY` (whole step hides) or revert the branch. The
  bucket can be left in place empty.
