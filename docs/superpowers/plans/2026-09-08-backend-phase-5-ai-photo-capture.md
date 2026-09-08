# Backend Phase 5 — AI Photo Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person add many knowledge items at once by uploading 1–3 photos: the AI reads them, returns a typed set of drafts, and the person confirms the set on a checklist before it saves.

**Architecture:** A new "Upload photos" mode on the existing AI-capture step. Photos are downscaled in the browser, uploaded to a transient Supabase Storage bucket, and passed as signed URLs to a new `src/ai/` service that returns `{ items: AiSuggestion[] }` from one vision call. A new review-checklist screen bulk-inserts the kept rows through one DB transaction. Staged photos are deleted on every exit path and swept hourly by a cron route.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Zod 4, `openai` SDK (already present), `@supabase/ssr` + `@supabase/supabase-js` (already present), Vitest, next-intl.

**Spec:** `docs/superpowers/specs/2026-09-08-backend-phase-5-ai-photo-capture-design.md` — read it alongside this plan.

## Global Constraints

- **Next.js is modified in this repo.** Before writing or changing any route handler or page component, read the relevant file under `node_modules/next/dist/docs/01-app/` (route handlers: `01-getting-started/15-route-handlers.md`; page API: `03-api-reference/03-file-conventions/page.md`). Heed deprecation notices.
- **If `next dev` re-adds the managed agent-rules block to `AGENTS.md` / `CLAUDE.md` and it shows in your diff, commit it with your work** — don't strip it.
- **Gates are exactly `npm run typecheck`, `npm run lint`, `npm test`.** Do **not** run `npm run format` / `format:check` and do **not** run `prettier --write` on files you touch — Prettier is red repo-wide by config and is not a gate.
- **No new npm dependencies.**
- **`AI_API_KEY` is optional.** With it unset: `getAiProvider()` returns `null`, the whole AI-capture step (text and photos) is hidden, and CI runs green. No test may make a live OpenAI call or a live Supabase Storage call — fake the provider, mock the Supabase client.
- **No live-database tests.** Never call `resetTables()`. Server service/action tests mock `@/server/repositories/*` and stub `@/server/db/client`'s `db.transaction` exactly like `src/server/services/knowledge-service.test.ts` does today.
- **Server/node test files** start with `// @vitest-environment node`; component test files use the default jsdom env and wrap in `<NextIntlClientProvider locale="en" messages={messages}>` (import `messages from "@/messages/en.json"`), except `add-knowledge-view.test.tsx` which mocks `next-intl` with a namespace-aware stub — match whichever style the file you're editing already uses.
- **Every new i18n key is added to BOTH `src/messages/en.json` and `src/messages/nl.json`.**
- **Fixed literals** (copy verbatim): bucket name `knowledge-capture-staging`; storage path shape `{userId}/{uuid}.jpg`; signed-URL TTL `60` seconds; max images per request `3`; max file size `10 * 1024 * 1024`; downscale target `1600` px long edge at JPEG quality `0.82`; max extracted items `30`; max grammar follow-up calls `3`; cron schedule `0 * * * *`; sweep age cutoff `60 * 60 * 1000` ms; saved-item `source` value `"ai-assisted"`.

---

### Task 1: Supabase browser client + capture-bucket constant

**Files:**
- Create: `src/lib/supabase/constants.ts`
- Create: `src/lib/supabase/browser.ts`
- Test: `src/lib/supabase/browser.test.ts`

**Interfaces:**
- Produces: `CAPTURE_BUCKET: "knowledge-capture-staging"` (from `constants.ts`); `createBrowserSupabaseClient(): SupabaseClient` (from `browser.ts`).

- [ ] **Step 1: Write the constant**

`src/lib/supabase/constants.ts`:

```ts
/** The transient staging bucket for AI photo capture (Backend Phase 5). Objects
 *  here are deleted as soon as extraction finishes and swept hourly by
 *  `/api/cron/sweep-capture-staging`. Client- and server-safe (no `server-only`). */
export const CAPTURE_BUCKET = "knowledge-capture-staging";
```

- [ ] **Step 2: Write the failing test**

`src/lib/supabase/browser.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

describe("createBrowserSupabaseClient", () => {
  it("returns a client exposing storage", async () => {
    const { createBrowserSupabaseClient } = await import("./browser");
    const client = createBrowserSupabaseClient();
    expect(typeof client.storage.from).toBe("function");
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `npx vitest run src/lib/supabase/browser.test.ts`
Expected: FAIL — `Cannot find module './browser'`.

- [ ] **Step 4: Write `src/lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client — the project's first. Shares the `@supabase/ssr`
 * cookie session with the server helper (`src/server/auth/supabase.ts`), so
 * Storage RLS applies as the signed-in user. Used only for uploading downscaled
 * photos to `CAPTURE_BUCKET` from the Add-knowledge screen.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/lib/supabase/browser.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/constants.ts src/lib/supabase/browser.ts src/lib/supabase/browser.test.ts
git commit -m "feat(phase-5): browser Supabase client + capture-bucket constant"
```

---

### Task 2: `knowledgeExtractionSchema`

**Files:**
- Modify: `src/ai/schemas/knowledge-suggestion.ts` (append after `toAiSuggestion`)
- Test: `src/ai/schemas/knowledge-suggestion.test.ts` (extend)

**Interfaces:**
- Consumes: `knowledgeSuggestionSchema` (existing, same file).
- Produces: `knowledgeExtractionSchema` (Zod), `type KnowledgeExtraction = { items: KnowledgeSuggestion[] }`.

- [ ] **Step 1: Write the failing test**

Append to `src/ai/schemas/knowledge-suggestion.test.ts`:

```ts
import { knowledgeExtractionSchema } from "./knowledge-suggestion";

describe("knowledgeExtractionSchema", () => {
  const vocab = { type: "vocabulary", term: "de fiets", meaning: "the bicycle" };
  const grammar = {
    type: "grammar",
    title: "V2",
    explanation: "finite verb second",
    examples: [{ nl: "Morgen ga ik.", en: "Tomorrow I go." }],
  };

  it("accepts a mixed set", () => {
    const r = knowledgeExtractionSchema.safeParse({ items: [vocab, grammar, { type: "note", body: "n" }] });
    expect(r.success).toBe(true);
  });

  it("rejects an empty set", () => {
    expect(knowledgeExtractionSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects more than 30 items", () => {
    const items = Array.from({ length: 31 }, () => vocab);
    expect(knowledgeExtractionSchema.safeParse({ items }).success).toBe(false);
  });

  it("rejects a set with one malformed member", () => {
    expect(
      knowledgeExtractionSchema.safeParse({ items: [vocab, { type: "vocabulary", term: "x" }] }).success,
    ).toBe(false);
  });

  it("has no summary field (extra keys stripped, summary not required)", () => {
    const r = knowledgeExtractionSchema.safeParse({ items: [vocab] });
    expect(r.success).toBe(true);
    if (r.success) expect("summary" in r.data).toBe(false);
  });

  it("keeps a vocabulary item's full grammatical extras", () => {
    const full = {
      type: "vocabulary",
      term: "werken",
      meaning: "to work",
      partOfSpeech: "verb",
      pastTense: "werkte",
      perfect: "heeft gewerkt",
      example: "Ik werk hier.",
      exampleTranslation: "I work here.",
      level: "A2",
      tags: ["werkwoord"],
    };
    const r = knowledgeExtractionSchema.safeParse({ items: [full] });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/ai/schemas/knowledge-suggestion.test.ts`
Expected: FAIL — `knowledgeExtractionSchema` is not exported.

- [ ] **Step 3: Add the schema**

Append to `src/ai/schemas/knowledge-suggestion.ts` (after `toAiSuggestion`):

```ts
/**
 * What the photo extractor returns — the whole item set from one vision call.
 * No summary: the output is just the items. Each entry is the same union member
 * the paste-text path uses, so `toAiSuggestion` maps it unchanged.
 */
export const knowledgeExtractionSchema = z.object({
  items: z.array(knowledgeSuggestionSchema).min(1).max(30),
});

export type KnowledgeExtraction = z.infer<typeof knowledgeExtractionSchema>;
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/ai/schemas/knowledge-suggestion.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/ai/schemas/knowledge-suggestion.ts src/ai/schemas/knowledge-suggestion.test.ts
git commit -m "feat(phase-5): knowledgeExtractionSchema envelope"
```

---

### Task 3: Lift `ensureGrammarExamples` into a shared module

**Files:**
- Create: `src/ai/services/grammar-examples.ts`
- Create: `src/ai/services/grammar-examples.test.ts`
- Modify: `src/ai/services/knowledge-processor.ts` (remove local `ensureGrammarExamples`, import it)

**Interfaces:**
- Consumes: `GRAMMAR_EXAMPLES_PROMPT` (from `@/ai/prompts/knowledge-processor`), `grammarExamplesResultSchema` (from `@/ai/schemas/knowledge-suggestion`), `AiProvider` (from `@/ai/providers`).
- Produces: `ensureGrammarExamples(provider: AiProvider, suggestion: AiSuggestion): Promise<void>` — best-effort; mutates `suggestion.examples` in place when it can, swallows failures.

- [ ] **Step 1: Write the failing test**

`src/ai/services/grammar-examples.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiSuggestion } from "@/types";

import { ensureGrammarExamples } from "./grammar-examples";

const generateStructured = vi.fn();
const provider = { name: "fake", generateStructured } as never;

beforeEach(() => generateStructured.mockReset());

function grammar(examples: { nl: string; en: string }[] = []): AiSuggestion {
  return { type: "grammar", fields: { title: "Perfectum", explanation: "hebben/zijn + participle" }, examples };
}

describe("ensureGrammarExamples", () => {
  it("does nothing for a non-grammar suggestion", async () => {
    const s: AiSuggestion = { type: "note", fields: { noteBody: "n" } };
    await ensureGrammarExamples(provider, s);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("does nothing when the grammar item already has examples", async () => {
    await ensureGrammarExamples(provider, grammar([{ nl: "Ik heb gewerkt.", en: "I have worked." }]));
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("fills examples from a follow-up call when there are none", async () => {
    generateStructured.mockResolvedValue({
      examples: [{ nl: "Ik heb gewerkt.", en: "I have worked." }],
    });
    const s = grammar();
    await ensureGrammarExamples(provider, s);
    expect(s.examples).toEqual([{ nl: "Ik heb gewerkt.", en: "I have worked." }]);
  });

  it("accepts the `sentences` alias key", async () => {
    generateStructured.mockResolvedValue({ sentences: [{ nl: "Hier woon ik.", en: "I live here." }] });
    const s = grammar();
    await ensureGrammarExamples(provider, s);
    expect(s.examples).toEqual([{ nl: "Hier woon ik.", en: "I live here." }]);
  });

  it("leaves the suggestion untouched when the follow-up throws", async () => {
    generateStructured.mockRejectedValue(new Error("boom"));
    const s = grammar();
    await ensureGrammarExamples(provider, s);
    expect(s.examples).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/ai/services/grammar-examples.test.ts`
Expected: FAIL — `Cannot find module './grammar-examples'`.

- [ ] **Step 3: Create `src/ai/services/grammar-examples.ts`**

Move the body of `ensureGrammarExamples` out of `knowledge-processor.ts` **verbatim**, only changing the log-prefix string:

```ts
import "server-only";

import type { AiProvider } from "@/ai/providers";
import { GRAMMAR_EXAMPLES_PROMPT } from "@/ai/prompts/knowledge-processor";
import { grammarExamplesResultSchema } from "@/ai/schemas/knowledge-suggestion";
import type { AiSuggestion } from "@/types";

/**
 * The model sometimes returns a grammar item with no `examples` (occasionally
 * putting the example sentences in `explanation` instead). Worked sentences are
 * the most useful part of a grammar card, so when they're missing we make one
 * focused follow-up call for them. Best-effort: a failure here leaves the
 * suggestion as-is — the reviewer can still add examples by hand.
 */
export async function ensureGrammarExamples(
  provider: AiProvider,
  suggestion: AiSuggestion,
): Promise<void> {
  if (suggestion.type !== "grammar" || (suggestion.examples?.length ?? 0) > 0) return;

  const { title = "", explanation = "" } = suggestion.fields;
  if (!explanation && !title) return;

  try {
    const result = await provider.generateStructured({
      system: GRAMMAR_EXAMPLES_PROMPT,
      user: `Rule: ${title}\n\n${explanation}`,
      schema: grammarExamplesResultSchema,
    });
    const checked = grammarExamplesResultSchema.safeParse(result);
    const list = checked.success ? (checked.data.examples ?? checked.data.sentences ?? []) : [];
    if (list.length > 0) {
      suggestion.examples = list.map((e) => ({ nl: e.nl, en: e.en ?? "" }));
    }
  } catch (error) {
    console.error(`[ai:grammar-examples] follow-up failed`, error);
  }
}
```

- [ ] **Step 4: Rewire `knowledge-processor.ts`**

In `src/ai/services/knowledge-processor.ts`:
- Delete the local `ensureGrammarExamples` function (the `async function ensureGrammarExamples(...)` block and its doc comment).
- Delete now-unused imports from that file: `GRAMMAR_EXAMPLES_PROMPT`, `grammarExamplesResultSchema`, and the `AiProvider` type import **if nothing else in the file uses them** (check — `KNOWLEDGE_PROCESSOR_PROMPT_V2` and `PROMPT_VERSION` stay; `knowledgeSuggestionSchema` and `toAiSuggestion` stay).
- Add: `import { ensureGrammarExamples } from "./grammar-examples";`
- The existing call `await ensureGrammarExamples(provider, suggestion);` inside `structureKnowledge` is unchanged.

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run src/ai/services/grammar-examples.test.ts src/ai/services/knowledge-processor.test.ts`
Expected: PASS — both. (`knowledge-processor.test.ts` still exercises the follow-up through the import.)

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean (no unused-import errors in `knowledge-processor.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/ai/services/grammar-examples.ts src/ai/services/grammar-examples.test.ts src/ai/services/knowledge-processor.ts
git commit -m "refactor(phase-5): lift ensureGrammarExamples into a shared module"
```

---

### Task 4: Provider image input

**Files:**
- Modify: `src/ai/providers/types.ts` (add `images?` to the `generateStructured` opts)
- Modify: `src/ai/providers/openai.ts` (build content-parts input; bump token ceiling when images present)
- Test: `src/ai/providers/openai.test.ts` (extend)

**Interfaces:**
- Produces: `AiProvider.generateStructured<T>(opts: { system; user; schema; images?: { url: string }[] }): Promise<T>` — when `images` is non-empty, they are sent as `input_image` parts alongside the `user` text.

- [ ] **Step 1: Write the failing test**

Append to `src/ai/providers/openai.test.ts`, inside `describe("OpenAIProvider.generateStructured", ...)`:

```ts
  it("sends images as input_image parts and raises the token ceiling", async () => {
    parse.mockResolvedValueOnce(ok({ type: "note", body: "from photo" }));

    await provider().generateStructured({
      system: "S",
      user: "U",
      schema,
      images: [{ url: "https://signed/one" }, { url: "https://signed/two" }],
    });

    const arg = parse.mock.calls[0][0];
    expect(Array.isArray(arg.input)).toBe(true);
    expect(arg.input[0].role).toBe("user");
    const parts = arg.input[0].content;
    expect(parts[0]).toMatchObject({ type: "input_text", text: "U" });
    expect(parts.filter((p: { type: string }) => p.type === "input_image")).toHaveLength(2);
    expect(parts[1].image_url).toBe("https://signed/one");
    expect(arg.max_output_tokens).toBe(32000);
  });

  it("keeps the plain-string input and 16000 ceiling when no images are given", async () => {
    parse.mockResolvedValueOnce(ok({ type: "note", body: "hi" }));
    await provider().generateStructured({ system: "S", user: "U", schema });
    const arg = parse.mock.calls[0][0];
    expect(arg.input).toBe("U");
    expect(arg.max_output_tokens).toBe(16000);
  });
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/ai/providers/openai.test.ts`
Expected: FAIL — `input` is still the string `"U"` when images are passed; `max_output_tokens` still 16000.

- [ ] **Step 3: Widen the interface**

In `src/ai/providers/types.ts`, change the `generateStructured` signature:

```ts
  generateStructured<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    /** Signed image URLs — sent as `input_image` parts when present. */
    images?: { url: string }[];
  }): Promise<T>;
```

- [ ] **Step 4: Implement in `openai.ts`**

In `src/ai/providers/openai.ts`, `generateStructured`:
- Add `images` to the destructured params and to the params type (mirror `types.ts`).
- Inside `attempt`, before the `parse` call, build the input and token ceiling:

```ts
      const hasImages = images != null && images.length > 0;
      const input = hasImages
        ? [
            {
              role: "user" as const,
              content: [
                { type: "input_text" as const, text: user },
                ...images!.map((img) => ({
                  type: "input_image" as const,
                  image_url: img.url,
                  detail: "auto" as const,
                })),
              ],
            },
          ]
        : user;

      response = await this.client.responses.parse({
        model: modelId,
        instructions: system,
        input,
        reasoning: { effort: "medium" },
        max_output_tokens: hasImages ? 32000 : 16000,
        text: { format: buildTextFormat(schema, "knowledge_suggestion") },
      });
```

(If the `openai@7` types reject `detail` on `input_image`, drop that key — it is optional. If they reject the literal `content` array shape, cast the whole `input` value `as never` at the call site with a one-line comment; the runtime shape above is what the Responses API expects.)

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/ai/providers/openai.test.ts`
Expected: PASS — new + existing (the existing "calls responses.parse with the primary model…" test still sees `arg.input === "U"` and `max_output_tokens === 16000`).

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/ai/providers/types.ts src/ai/providers/openai.ts src/ai/providers/openai.test.ts
git commit -m "feat(phase-5): AiProvider.generateStructured accepts image parts"
```

---

### Task 5: Extraction prompt + `extractKnowledgeFromImages` service

**Files:**
- Create: `src/ai/prompts/knowledge-extractor.ts`
- Create: `src/ai/services/knowledge-extractor.ts`
- Create: `src/ai/services/knowledge-extractor.test.ts`
- Modify: `src/ai/README.md` (services row)

**Interfaces:**
- Consumes: `getAiProvider` (`@/ai/providers`), `knowledgeExtractionSchema` + `toAiSuggestion` (`@/ai/schemas/knowledge-suggestion`), `ensureGrammarExamples` (`@/ai/services/grammar-examples`).
- Produces:
  - `KNOWLEDGE_EXTRACTION_PROMPT: string`, `EXTRACTION_PROMPT_VERSION = "v1"`.
  - `type ExtractResult = { status: "ok"; items: AiSuggestion[]; truncated: boolean } | { status: "unavailable" } | { status: "error" }`.
  - `extractKnowledgeFromImages(images: { url: string }[]): Promise<ExtractResult>`.

- [ ] **Step 1: Write the prompt**

`src/ai/prompts/knowledge-extractor.ts`:

```ts
/**
 * System prompt for the photo-extraction step (Backend Phase 5). Bump the
 * version and add a new const (never edit one in place) when the wording
 * changes materially, so failures can be attributed to a revision.
 *
 * Reuses the per-type field guidance from `KNOWLEDGE_PROCESSOR_PROMPT_V2`
 * almost verbatim; the only real changes are: input is one or more photos, and
 * the output is a list. No summary of the upload is produced.
 */
export const EXTRACTION_PROMPT_VERSION = "v1" as const;

export const KNOWLEDGE_EXTRACTION_PROMPT = `You extract study material from photos for a Dutch-language learning app used by a small group of learners. The images may be a worksheet, a textbook page, a whiteboard, or handwritten notes.

Read ALL the provided images together as one source. If the same word or rule appears in more than one image, include it once.

Return an "items" array. For EACH distinct thing to learn, add one entry of the right type, filling every field for that type that genuinely applies. Omit a field rather than invent a value you are unsure of.

- vocabulary — a single word or short phrase.
    term: the Dutch word or phrase, exactly as written.
    meaning: a concise English gloss.
    partOfSpeech: English, e.g. "noun", "verb", "adjective"; omit if unclear.
    Also fill any that apply: article ("de"/"het", nouns only); plural (nouns);
    pastTense, perfect (verbs, e.g. "werkte", "heeft gewerkt"); example (a short
    natural Dutch sentence using the word) and exampleTranslation (its English);
    usageNote (register, a common mistake, or a useful collocation — only if
    genuinely helpful).
  A list of 10 words becomes 10 vocabulary items.

- grammar — a rule, pattern, or explanation about how Dutch works.
    title: a short English name for the rule.
    explanation: the rule in English prose only. Do NOT put example sentences here.
    examples: 2-4 short Dutch sentences that demonstrate the rule, each with nl
    and its English en. Required unless the rule genuinely cannot be shown in a
    sentence. Every Dutch example sentence goes here, never in explanation.
    summary: one English sentence; omit if you cannot make it genuinely useful.

- reading — a passage of Dutch text meant to be read.
    title: a short English or Dutch title.
    body: the passage, verbatim — never translate or edit it.
    summary: one or two English sentences; omit if unsure.

- note — anything that is not one of the above: a reminder, a question, a loose
  observation. body: the text, kept in the learner's wording. title: optional.

Every item also takes:
  level: a proposed CEFR level — one of A1, A2, B1, B2, C1, C2. The reviewer confirms it.
  tags: 0-4 short lowercase tags (Dutch or English).
  noticeKey: optionally, the single most useful thing the reviewer should double-check,
  chosen from: checkTypeAndLevel, titleAndSummary, summaryAndExamples, meaningAndType.
  Omit if nothing stands out.

Rules:
- term is always Dutch; meaning is always English.
- Keep the learner's wording for a reading body or a note body — never translate or rewrite it.
- For vocabulary, do not invent conjugations, plurals, or articles that are not standard Dutch — omit the field instead.
- Do NOT describe or summarise the photos. Return only items.
- Return at most 30 items. If the photos contain more, return the 30 most useful and nothing else.
- Return only the structured object. No commentary.`;
```

- [ ] **Step 2: Write the failing test**

`src/ai/services/knowledge-extractor.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateStructured, getAiProvider, ensureGrammarExamples } = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  getAiProvider: vi.fn(),
  ensureGrammarExamples: vi.fn(),
}));

vi.mock("@/ai/providers", () => ({
  getAiProvider,
  AiProviderError: class AiProviderError extends Error {},
}));
vi.mock("@/ai/services/grammar-examples", () => ({ ensureGrammarExamples }));

import { extractKnowledgeFromImages } from "./knowledge-extractor";

const IMAGES = [{ url: "https://signed/one" }];

beforeEach(() => {
  generateStructured.mockReset();
  getAiProvider.mockReset();
  ensureGrammarExamples.mockReset();
  getAiProvider.mockReturnValue({ name: "fake", generateStructured });
});

describe("extractKnowledgeFromImages", () => {
  it("returns unavailable when no provider is configured", async () => {
    getAiProvider.mockReturnValue(null);
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "unavailable" });
  });

  it("returns error when given no images", async () => {
    expect(await extractKnowledgeFromImages([])).toEqual({ status: "error" });
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("maps a mixed set through toAiSuggestion, preserving per-type fields", async () => {
    generateStructured.mockResolvedValue({
      items: [
        {
          type: "vocabulary",
          term: "werken",
          meaning: "to work",
          partOfSpeech: "verb",
          pastTense: "werkte",
          perfect: "heeft gewerkt",
        },
        { type: "note", body: "ask about er" },
      ],
    });

    const result = await extractKnowledgeFromImages(IMAGES);

    expect(result).toMatchObject({ status: "ok", truncated: false });
    if (result.status !== "ok") throw new Error("unreachable");
    expect(result.items[0]).toMatchObject({
      type: "vocabulary",
      fields: { term: "werken", meaning: "to work", pastTense: "werkte", perfect: "heeft gewerkt" },
    });
    expect(result.items[1]).toMatchObject({ type: "note" });
  });

  it("flags truncated when exactly 30 items come back", async () => {
    const items = Array.from({ length: 30 }, () => ({ type: "note", body: "n" }));
    generateStructured.mockResolvedValue({ items });
    const result = await extractKnowledgeFromImages(IMAGES);
    expect(result).toMatchObject({ status: "ok", truncated: true });
  });

  it("runs the grammar follow-up for at most 3 grammar items without examples", async () => {
    const grammar = (i: number) => ({ type: "grammar", title: `R${i}`, explanation: "e" });
    generateStructured.mockResolvedValue({
      items: [grammar(1), grammar(2), grammar(3), grammar(4), { type: "note", body: "n" }],
    });
    await extractKnowledgeFromImages(IMAGES);
    expect(ensureGrammarExamples).toHaveBeenCalledTimes(3);
  });

  it("does not run the follow-up for a grammar item that already has examples", async () => {
    generateStructured.mockResolvedValue({
      items: [
        { type: "grammar", title: "V2", explanation: "e", examples: [{ nl: "Nu ga ik.", en: "Now I go." }] },
      ],
    });
    await extractKnowledgeFromImages(IMAGES);
    expect(ensureGrammarExamples).not.toHaveBeenCalled();
  });

  it("returns error when the provider throws", async () => {
    generateStructured.mockRejectedValue(new Error("rate limited"));
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "error" });
  });

  it("returns error when the envelope is schema-invalid", async () => {
    generateStructured.mockResolvedValue({ items: [{ type: "vocabulary", term: "x" }] });
    expect(await extractKnowledgeFromImages(IMAGES)).toEqual({ status: "error" });
  });

  it("passes the extraction prompt and the images to the provider", async () => {
    generateStructured.mockResolvedValue({ items: [{ type: "note", body: "n" }] });
    await extractKnowledgeFromImages([{ url: "https://a" }, { url: "https://b" }]);
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.system).toContain("extract study material from photos");
    expect(arg.images).toEqual([{ url: "https://a" }, { url: "https://b" }]);
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `npx vitest run src/ai/services/knowledge-extractor.test.ts`
Expected: FAIL — `Cannot find module './knowledge-extractor'`.

- [ ] **Step 4: Write `src/ai/services/knowledge-extractor.ts`**

```ts
import "server-only";

import {
  EXTRACTION_PROMPT_VERSION,
  KNOWLEDGE_EXTRACTION_PROMPT,
} from "@/ai/prompts/knowledge-extractor";
import { getAiProvider } from "@/ai/providers";
import {
  knowledgeExtractionSchema,
  toAiSuggestion,
} from "@/ai/schemas/knowledge-suggestion";
import { ensureGrammarExamples } from "@/ai/services/grammar-examples";
import type { AiSuggestion } from "@/types";

export type ExtractResult =
  | { status: "ok"; items: AiSuggestion[]; truncated: boolean }
  | { status: "unavailable" }
  | { status: "error" };

const MAX_IMAGES = 3;
const MAX_ITEMS = 30;
const MAX_GRAMMAR_FOLLOWUPS = 3;

/**
 * Read 1–3 photos and return a reviewable set of `AiSuggestion`s. Never throws:
 * `unavailable` means no API key, `error` means the model call failed or
 * returned something unusable. The caller always drops the reviewer into the
 * checklist (or, on `error`/empty, the manual form), so a soft failure is fine.
 */
export async function extractKnowledgeFromImages(
  images: { url: string }[],
): Promise<ExtractResult> {
  try {
    const provider = getAiProvider();
    if (!provider) return { status: "unavailable" };

    const imgs = images.slice(0, MAX_IMAGES);
    if (imgs.length === 0) return { status: "error" };

    const user = `Extract every distinct study item from the ${imgs.length} attached image(s), with all per-type fields.`;

    const raw = await provider.generateStructured({
      system: KNOWLEDGE_EXTRACTION_PROMPT,
      user,
      schema: knowledgeExtractionSchema,
      images: imgs,
    });

    const parsed = knowledgeExtractionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] schema validation failed`,
        parsed.error.issues,
      );
      return { status: "error" };
    }

    const items = parsed.data.items.map(toAiSuggestion);

    let followups = 0;
    for (const item of items) {
      if (followups >= MAX_GRAMMAR_FOLLOWUPS) break;
      if (item.type === "grammar" && (item.examples?.length ?? 0) === 0) {
        followups += 1;
        await ensureGrammarExamples(provider, item);
      }
    }

    return { status: "ok", items, truncated: parsed.data.items.length >= MAX_ITEMS };
  } catch (error) {
    console.error(`[ai:knowledge-extractor:${EXTRACTION_PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}
```

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/ai/services/knowledge-extractor.test.ts`
Expected: PASS.

- [ ] **Step 6: Update `src/ai/README.md`**

In the `ai/services/` row of the layout table, add `knowledge-extractor` to the "Implemented" list and note the shared `grammar-examples` helper. One line under **Flow** is enough:

```
The knowledge processor and the photo extractor share `ensureGrammarExamples`
(`ai/services/grammar-examples.ts`) for the grammar-examples follow-up call.
```

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/ai/prompts/knowledge-extractor.ts src/ai/services/knowledge-extractor.ts src/ai/services/knowledge-extractor.test.ts src/ai/README.md
git commit -m "feat(phase-5): extractKnowledgeFromImages service + prompt"
```

---

### Task 6: `capturePathsSchema` + `extractFromPhotosAction`

**Files:**
- Modify: `src/server/actions/schemas.ts` (add `capturePathsSchema`)
- Modify: `src/server/actions/ai.ts` (add `extractFromPhotosAction`)
- Test: `src/server/actions/ai.test.ts` (extend)

**Interfaces:**
- Consumes: `extractKnowledgeFromImages` (`@/ai/services/knowledge-extractor`), `resolveActiveContext` (`@/server/services/session-service`), `createServerSupabaseClient` (`@/server/auth/supabase`), `CAPTURE_BUCKET` (`@/lib/supabase/constants`).
- Produces: `capturePathsSchema` (Zod: 1–3 `"{uuid}/{name}.jpg"` strings); `extractFromPhotosAction(paths: unknown): Promise<ActionResult<{ items: AiSuggestion[]; truncated: boolean }>>`.

- [ ] **Step 1: Add `capturePathsSchema`**

In `src/server/actions/schemas.ts`, after `rawKnowledgeTextSchema`:

```ts
/**
 * Storage paths for AI photo capture — `"{userId}/{uuid}.jpg"`, 1–3 of them.
 * The action additionally checks each path is under the caller's own id prefix.
 */
export const capturePathsSchema = z
  .array(z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+\.jpg$/))
  .min(1)
  .max(3);
```

- [ ] **Step 2: Write the failing tests**

Append to `src/server/actions/ai.test.ts`. Extend the hoisted mocks and add a storage mock:

```ts
const { structureKnowledge, extractKnowledgeFromImages, resolveActiveContext, createServerSupabaseClient } =
  vi.hoisted(() => ({
    structureKnowledge: vi.fn(),
    extractKnowledgeFromImages: vi.fn(),
    resolveActiveContext: vi.fn(),
    createServerSupabaseClient: vi.fn(),
  }));

vi.mock("@/ai/services/knowledge-processor", () => ({ structureKnowledge }));
vi.mock("@/ai/services/knowledge-extractor", () => ({ extractKnowledgeFromImages }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext }));
vi.mock("@/server/auth/supabase", () => ({ createServerSupabaseClient }));

import { extractFromPhotosAction, structureKnowledgeAction } from "./ai";
```

(The existing `structureKnowledgeAction` block stays. Keep the existing `beforeEach` `resolveActiveContext.mockResolvedValue({ status: "ok", ... })` — add `user: { id: "u1", ... }` if not already the shape; it already is.)

Add:

```ts
function fakeStorage() {
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: "https://signed/x" }, error: null });
  const from = vi.fn(() => ({ createSignedUrl, remove }));
  return { client: { storage: { from } }, from, createSignedUrl, remove };
}

describe("extractFromPhotosAction", () => {
  const goodPaths = ["11111111-1111-1111-1111-111111111111/a.jpg"];

  beforeEach(() => {
    extractKnowledgeFromImages.mockReset();
    createServerSupabaseClient.mockReset();
    resolveActiveContext.mockResolvedValue({
      status: "ok",
      user: { id: "11111111-1111-1111-1111-111111111111", name: "U", initials: "UU", avatarUrl: null },
      activeGroup: { id: "g1", name: "G", slug: "g" },
      membership: { groupId: "g1", userId: "11111111-1111-1111-1111-111111111111", role: "member" },
    });
  });

  it("rejects zero paths and more than three", async () => {
    expect(await extractFromPhotosAction([])).toMatchObject({ ok: false, code: "validation" });
    expect(
      await extractFromPhotosAction([
        "11111111-1111-1111-1111-111111111111/a.jpg",
        "11111111-1111-1111-1111-111111111111/b.jpg",
        "11111111-1111-1111-1111-111111111111/c.jpg",
        "11111111-1111-1111-1111-111111111111/d.jpg",
      ]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a non-.jpg path", async () => {
    expect(
      await extractFromPhotosAction(["11111111-1111-1111-1111-111111111111/a.png"]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a path outside the caller's own prefix", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    const r = await extractFromPhotosAction(["22222222-2222-2222-2222-222222222222/a.jpg"]);
    expect(r).toMatchObject({ ok: false, code: "validation" });
    expect(extractKnowledgeFromImages).not.toHaveBeenCalled();
  });

  it("returns items on ok and deletes the staged objects", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromImages.mockResolvedValue({
      status: "ok",
      items: [{ type: "note", fields: { title: "", noteBody: "n" } }],
      truncated: false,
    });

    const r = await extractFromPhotosAction(goodPaths);

    expect(r).toEqual({ ok: true, data: { items: [{ type: "note", fields: { title: "", noteBody: "n" } }], truncated: false } });
    expect(s.createSignedUrl).toHaveBeenCalledWith(goodPaths[0], 60);
    expect(extractKnowledgeFromImages).toHaveBeenCalledWith([{ url: "https://signed/x" }]);
    expect(s.remove).toHaveBeenCalledWith(goodPaths);
  });

  it("deletes the staged objects even when extraction errors", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromImages.mockResolvedValue({ status: "error" });

    const r = await extractFromPhotosAction(goodPaths);

    expect(r).toMatchObject({ ok: false, code: "ai-error" });
    expect(s.remove).toHaveBeenCalledWith(goodPaths);
  });

  it("maps unavailable → ai-unavailable", async () => {
    const s = fakeStorage();
    createServerSupabaseClient.mockResolvedValue(s.client);
    extractKnowledgeFromImages.mockResolvedValue({ status: "unavailable" });
    expect(await extractFromPhotosAction(goodPaths)).toMatchObject({ ok: false, code: "ai-unavailable" });
  });

  it("rejects when there is no active context", async () => {
    resolveActiveContext.mockResolvedValue({ status: "needs-login" });
    expect(await extractFromPhotosAction(goodPaths)).toMatchObject({ ok: false, code: "unauthorized" });
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `npx vitest run src/server/actions/ai.test.ts`
Expected: FAIL — `extractFromPhotosAction` is not exported.

- [ ] **Step 4: Implement `extractFromPhotosAction`**

In `src/server/actions/ai.ts`:

```ts
import { extractKnowledgeFromImages } from "@/ai/services/knowledge-extractor";
import { structureKnowledge } from "@/ai/services/knowledge-processor";
import { CAPTURE_BUCKET } from "@/lib/supabase/constants";
import { createServerSupabaseClient } from "@/server/auth/supabase";
import { resolveActiveContext } from "@/server/services/session-service";
import type { AiSuggestion } from "@/types";

import { type ActionResult, capturePathsSchema, rawKnowledgeTextSchema } from "./schemas";
```

Add the action (keep `structureKnowledgeAction` as-is):

```ts
/**
 * Read 1–3 already-uploaded staging photos into a reviewable set of
 * `AiSuggestion`s. Nothing is persisted — the reviewer confirms the set on the
 * checklist, which then calls `createKnowledgeItemsAction`. The staged objects
 * are deleted on every exit path; the hourly sweep is the backstop.
 */
export async function extractFromPhotosAction(
  paths: unknown,
): Promise<ActionResult<{ items: AiSuggestion[]; truncated: boolean }>> {
  const parsed = capturePathsSchema.safeParse(paths);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: "Invalid photo upload" };
  }

  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") {
    return { ok: false, code: "unauthorized", message: "Sign in to use AI capture" };
  }

  if (parsed.data.some((p) => !p.startsWith(`${ctx.user.id}/`))) {
    return { ok: false, code: "validation", message: "Invalid photo upload" };
  }

  const supabase = await createServerSupabaseClient();
  const bucket = supabase.storage.from(CAPTURE_BUCKET);

  try {
    const signed = await Promise.all(
      parsed.data.map(async (path) => {
        const { data, error } = await bucket.createSignedUrl(path, 60);
        if (error || !data) throw new Error(error?.message ?? "could not sign upload");
        return { url: data.signedUrl };
      }),
    );

    const result = await extractKnowledgeFromImages(signed);
    switch (result.status) {
      case "ok":
        return { ok: true, data: { items: result.items, truncated: result.truncated } };
      case "unavailable":
        return { ok: false, code: "ai-unavailable", message: "AI capture is not available" };
      case "error":
        return { ok: false, code: "ai-error", message: "Could not read those photos — add items manually" };
    }
  } catch (error) {
    console.error("[action:extractFromPhotos] failed", error);
    return { ok: false, code: "ai-error", message: "Could not read those photos — add items manually" };
  } finally {
    void bucket.remove(parsed.data).catch(() => {});
  }
}
```

Note: `supabase.storage.from(...)` is called once and reused for both signing and removal, so the test's `from` mock returns one object carrying both methods.

- [ ] **Step 5: Run tests, expect pass**

Run: `npx vitest run src/server/actions/ai.test.ts`
Expected: PASS — new + existing.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/server/actions/schemas.ts src/server/actions/ai.ts src/server/actions/ai.test.ts
git commit -m "feat(phase-5): extractFromPhotosAction — sign, extract, sweep"
```

---

### Task 7: `buildKnowledgeRow` + `createKnowledgeItems` service

**Files:**
- Modify: `src/server/services/knowledge-service.ts`
- Test: `src/server/services/knowledge-service.test.ts` (extend)

**Interfaces:**
- Produces:
  - `buildKnowledgeRow(ctx: { groupId: string; userId: string }, input: CreateKnowledgeItemInput): NewKnowledgeItemRow` — the per-type row builder, extracted from `createKnowledgeItem`.
  - `createKnowledgeItems(inputs: CreateKnowledgeItemInput[]): Promise<KnowledgeItem[]>` — one `db.transaction`, one `insertKnowledgeItem` per input, all-or-nothing.
- Consumes: existing `insertKnowledgeItem` (`@/server/repositories/knowledge`), `db` (`@/server/db/client`), `requireActiveGroupId` (module-local), `wordCount` (module-local).

- [ ] **Step 1: Write the failing tests**

Append to `src/server/services/knowledge-service.test.ts`. Add `createKnowledgeItems` (and, if you want to assert it directly, `buildKnowledgeRow`) to the import from `./knowledge-service`, then:

```ts
describe("createKnowledgeItems", () => {
  beforeEach(() => {
    vi.mocked(resolveActiveContext).mockResolvedValue(okCtx);
    vi.mocked(repo.insertKnowledgeItem).mockImplementation(async (_tx, row) => ({
      ...vocab(),
      id: `id-${(row as { type: string }).type}`,
      type: (row as { type: string }).type,
    }) as never);
  });

  it("inserts one row per input inside a single transaction and returns them", async () => {
    const out = await createKnowledgeItems([
      { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "n1" },
      { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "n2" },
    ]);
    expect(repo.insertKnowledgeItem).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(2);
  });

  it("maps a reading input with a computed wordCount", async () => {
    await createKnowledgeItems([
      {
        type: "reading",
        level: null,
        tags: [],
        source: "ai-assisted",
        title: "T",
        body: "een twee drie vier",
        summary: null,
      },
    ]);
    const row = vi.mocked(repo.insertKnowledgeItem).mock.calls[0][1] as Record<string, unknown>;
    expect(row).toMatchObject({ type: "reading", wordCount: 4, vocabularyIds: [] });
  });

  it("rolls the whole batch back when one row throws", async () => {
    vi.mocked(repo.insertKnowledgeItem)
      .mockResolvedValueOnce(vocab() as never)
      .mockRejectedValueOnce(new Error("db boom"));
    await expect(
      createKnowledgeItems([
        { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "ok" },
        { type: "note", level: null, tags: [], source: "ai-assisted", title: null, body: "bad" },
      ]),
    ).rejects.toThrow("db boom");
  });
});
```

Also add one assertion to the existing `createKnowledgeItem` describe block confirming it still works after the `buildKnowledgeRow` extraction (there is already coverage there — just re-run it).

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/server/services/knowledge-service.test.ts`
Expected: FAIL — `createKnowledgeItems` is not exported.

- [ ] **Step 3: Extract `buildKnowledgeRow` and add `createKnowledgeItems`**

In `src/server/services/knowledge-service.ts`:

- Add the import for the row type:

```ts
import type { NewKnowledgeItemRow } from "@/server/db/schema";
```

- Extract the per-type switch currently inline in `createKnowledgeItem` into a module function:

```ts
/** Shape one validated create-input into the DB row, per type. Shared by the
 *  single-item and batch create paths so they cannot drift. */
export function buildKnowledgeRow(
  ctx: { groupId: string; userId: string },
  input: CreateKnowledgeItemInput,
): NewKnowledgeItemRow {
  const shared = {
    groupId: ctx.groupId,
    addedBy: ctx.userId,
    level: input.level,
    tags: input.tags,
    source: input.source,
  };

  switch (input.type) {
    case "vocabulary":
      return { ...shared, ...input, type: "vocabulary" };
    case "grammar":
      return { ...shared, ...input, type: "grammar" };
    case "reading":
      return {
        ...shared,
        ...input,
        type: "reading",
        wordCount: wordCount(input.body),
        vocabularyIds: [],
      };
    case "note":
      return { ...shared, ...input, type: "note" };
  }
}
```

(If TypeScript objects to the union spread against `NewKnowledgeItemRow`, add `satisfies NewKnowledgeItemRow` to each `return` object or, matching the pre-existing style in this file, drop the explicit return type and let it infer from `insertKnowledgeItem`'s parameter — do **not** introduce `as` casts.)

- Rewrite `createKnowledgeItem` to use it:

```ts
export async function createKnowledgeItem(input: CreateKnowledgeItemInput): Promise<KnowledgeItem> {
  const { groupId, userId } = await requireActiveGroupId();
  return db.transaction((tx) =>
    insertKnowledgeItem(tx as unknown as Db, buildKnowledgeRow({ groupId, userId }, input)),
  );
}
```

- Add the batch function right after it:

```ts
/**
 * Bulk-create knowledge items from the AI photo-capture review checklist. One
 * transaction, one `insertKnowledgeItem` per input, sequential so the rows
 * share the connection cleanly. Any row throwing rolls the whole batch back.
 */
export async function createKnowledgeItems(
  inputs: CreateKnowledgeItemInput[],
): Promise<KnowledgeItem[]> {
  const { groupId, userId } = await requireActiveGroupId();
  return db.transaction(async (tx) => {
    const dbtx = tx as unknown as Db;
    const created: KnowledgeItem[] = [];
    for (const input of inputs) {
      created.push(await insertKnowledgeItem(dbtx, buildKnowledgeRow({ groupId, userId }, input)));
    }
    return created;
  });
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/server/services/knowledge-service.test.ts`
Expected: PASS — new + existing (the `db.transaction` test mock, `(cb) => cb({})`, handles the async callback).

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/knowledge-service.ts src/server/services/knowledge-service.test.ts
git commit -m "feat(phase-5): createKnowledgeItems batch service + shared buildKnowledgeRow"
```

---

### Task 8: `createKnowledgeItemsAction`

**Files:**
- Modify: `src/server/actions/knowledge.ts`
- Test: `src/server/actions/knowledge.test.ts` (new file)

**Interfaces:**
- Consumes: `createKnowledgeItems` (`@/server/services/knowledge-service`), `createKnowledgeItemSchema` + `toActionError` (`./schemas`).
- Produces: `createKnowledgeItemsAction(inputs: unknown): Promise<ActionResult<{ ids: string[] }>>`.

- [ ] **Step 1: Write the failing test**

`src/server/actions/knowledge.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createKnowledgeItems } = vi.hoisted(() => ({ createKnowledgeItems: vi.fn() }));

vi.mock("@/server/services/knowledge-service", () => ({
  createKnowledgeItem: vi.fn(),
  createKnowledgeItems,
  deleteKnowledgeItem: vi.fn(),
  getKnowledgeByIds: vi.fn(),
  updateKnowledgeItem: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createKnowledgeItemsAction } from "./knowledge";

const noteInput = {
  type: "note" as const,
  level: null,
  tags: [] as string[],
  source: "ai-assisted" as const,
  title: null,
  body: "a note",
};

beforeEach(() => createKnowledgeItems.mockReset());

describe("createKnowledgeItemsAction", () => {
  it("rejects an empty array", async () => {
    expect(await createKnowledgeItemsAction([])).toMatchObject({ ok: false, code: "validation" });
    expect(createKnowledgeItems).not.toHaveBeenCalled();
  });

  it("rejects more than 30 items", async () => {
    const many = Array.from({ length: 31 }, () => noteInput);
    expect(await createKnowledgeItemsAction(many)).toMatchObject({ ok: false, code: "validation" });
  });

  it("rejects a malformed row", async () => {
    expect(
      await createKnowledgeItemsAction([{ type: "note", body: "" }]),
    ).toMatchObject({ ok: false, code: "validation" });
  });

  it("returns the created ids on success", async () => {
    createKnowledgeItems.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const r = await createKnowledgeItemsAction([noteInput, noteInput]);
    expect(r).toEqual({ ok: true, data: { ids: ["a", "b"] } });
  });

  it("maps a thrown service error to a non-ok result with a string code", async () => {
    createKnowledgeItems.mockRejectedValue(new Error("db boom"));
    const r = await createKnowledgeItemsAction([noteInput]);
    expect(r.ok).toBe(false);
    expect(typeof (r as { code: string }).code).toBe("string");
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/server/actions/knowledge.test.ts`
Expected: FAIL — `createKnowledgeItemsAction` is not exported.

- [ ] **Step 3: Implement the action**

In `src/server/actions/knowledge.ts`:
- Add `z` import: `import { z } from "zod";`
- Add `createKnowledgeItems` to the import from `@/server/services/knowledge-service`.
- Add the action:

```ts
export async function createKnowledgeItemsAction(
  inputs: unknown,
): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = z.array(createKnowledgeItemSchema).min(1).max(30).safeParse(inputs);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: "Invalid knowledge items" };
  }
  try {
    const items = await createKnowledgeItems(parsed.data);
    revalidatePath("/today");
    revalidatePath("/library");
    return { ok: true, data: { ids: items.map((i) => i.id) } };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/server/actions/knowledge.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/server/actions/knowledge.ts src/server/actions/knowledge.test.ts
git commit -m "feat(phase-5): createKnowledgeItemsAction"
```

---

### Task 9: `downscaleImage` client util

**Files:**
- Create: `src/features/add/downscale-image.ts`
- Test: `src/features/add/downscale-image.test.ts`

**Interfaces:**
- Produces:
  - `fitWithin(width: number, height: number, maxEdge?: number): { width: number; height: number }` — pure.
  - `downscaleImage(file: File): Promise<Blob>` — returns a JPEG blob ≤ 1600 px on the long edge; rejects with `ImageDecodeError` when the browser can't decode the file.
  - `class ImageDecodeError extends Error`.

- [ ] **Step 1: Write the failing test**

`src/features/add/downscale-image.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { downscaleImage, fitWithin, ImageDecodeError } from "./downscale-image";

describe("fitWithin", () => {
  it("scales a large landscape image to a 1600 px long edge", () => {
    expect(fitWithin(3200, 2400)).toEqual({ width: 1600, height: 1200 });
  });
  it("scales a large portrait image to a 1600 px long edge", () => {
    expect(fitWithin(1000, 4000)).toEqual({ width: 400, height: 1600 });
  });
  it("leaves a small image untouched", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("downscaleImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects with ImageDecodeError when the image can't be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad format")));
    await expect(downscaleImage(new File([], "x.heic"))).rejects.toBeInstanceOf(ImageDecodeError);
  });

  it("returns a JPEG blob sized to the fitted dimensions", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 3200, height: 2400, close: vi.fn() }),
    );
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
    const ctor = vi.fn(function OffscreenCanvasMock(this: Record<string, unknown>, w: number, h: number) {
      this.width = w;
      this.height = h;
      this.getContext = () => ({ drawImage });
      this.convertToBlob = convertToBlob;
    });
    vi.stubGlobal("OffscreenCanvas", ctor as unknown as typeof OffscreenCanvas);

    const blob = await downscaleImage(new File(["y"], "photo.jpg", { type: "image/jpeg" }));

    expect(ctor).toHaveBeenCalledWith(1600, 1200);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/jpeg", quality: 0.82 });
    expect(blob.type).toBe("image/jpeg");
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/features/add/downscale-image.test.ts`
Expected: FAIL — `Cannot find module './downscale-image'`.

- [ ] **Step 3: Write `src/features/add/downscale-image.ts`**

```ts
/** The browser could not decode the picked image (most often HEIC outside
 *  Safari). The caller shows `add.ai.photos.rejectedFormat`. */
export class ImageDecodeError extends Error {
  constructor() {
    super("Could not decode image");
    this.name = "ImageDecodeError";
  }
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** Fit `width` × `height` inside a `maxEdge` square, preserving aspect ratio.
 *  Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Re-encode a picked photo to a JPEG no larger than 1600 px on its long edge,
 * entirely in the browser. Keeps the Storage upload small and the vision call
 * cheap. Rejects with `ImageDecodeError` if the browser can't read the file.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageDecodeError();
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new ImageDecodeError();
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/features/add/downscale-image.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/add/downscale-image.ts src/features/add/downscale-image.test.ts
git commit -m "feat(phase-5): downscaleImage browser util"
```

---

### Task 10: `suggestion-to-input.ts` — extract the builder, add draft helpers

**Files:**
- Create: `src/features/add/suggestion-to-input.ts`
- Create: `src/features/add/suggestion-to-input.test.ts`
- Modify: `src/features/add/add-knowledge-view.tsx` (import `buildCreateInput` from the new file; delete the local copy + its two helpers)

**Interfaces:**
- Produces:
  - `buildCreateInput(type: AuthableType, values: Values, examples: Example[], source: KnowledgeSource): CreateKnowledgeItemInput` — moved verbatim from `add-knowledge-view.tsx`.
  - `suggestionToDraft(s: AiSuggestion): { type: AuthableType; values: Values; examples: Example[] }`.
  - `missingRequired(type: AuthableType, values: Values): string[]` — required field names not yet filled.
- Consumes: `REQUIRED`, `AuthableType`, `Example`, `Values` (`./types`); `CreateKnowledgeItemInput` (type-only, `@/server/actions/schemas`); `AiSuggestion`, `KnowledgeSource` (`@/types`).

- [ ] **Step 1: Write the failing test**

`src/features/add/suggestion-to-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { AiSuggestion } from "@/types";

import { buildCreateInput, missingRequired, suggestionToDraft } from "./suggestion-to-input";

describe("suggestionToDraft", () => {
  it("copies fields and assigns ids to grammar examples", () => {
    const s: AiSuggestion = {
      type: "grammar",
      fields: { title: "V2", summary: "", explanation: "verb second" },
      examples: [{ nl: "Nu ga ik.", en: "Now I go." }],
    };
    const draft = suggestionToDraft(s);
    expect(draft.type).toBe("grammar");
    expect(draft.values.title).toBe("V2");
    expect(draft.examples[0]).toMatchObject({ nl: "Nu ga ik.", en: "Now I go." });
    expect(typeof draft.examples[0].id).toBe("string");
  });
});

describe("missingRequired", () => {
  it("flags a vocabulary draft with no partOfSpeech", () => {
    expect(missingRequired("vocabulary", { term: "de fiets", meaning: "the bike", partOfSpeech: "" })).toEqual([
      "partOfSpeech",
    ]);
  });
  it("flags a grammar draft with no summary", () => {
    expect(missingRequired("grammar", { title: "V2", summary: "  ", explanation: "e" })).toEqual(["summary"]);
  });
  it("returns nothing when every required field is filled", () => {
    expect(missingRequired("note", { noteBody: "hello" })).toEqual([]);
  });
});

describe("buildCreateInput", () => {
  it("builds a valid vocabulary input", () => {
    const input = buildCreateInput(
      "vocabulary",
      { term: "de fiets", meaning: "the bike", partOfSpeech: "noun", article: "de", level: "A1", tags: "vervoer" },
      [],
      "ai-assisted",
    );
    expect(input).toMatchObject({ type: "vocabulary", term: "de fiets", article: "de", source: "ai-assisted" });
  });
  it("drops blank grammar examples", () => {
    const input = buildCreateInput(
      "grammar",
      { title: "V2", summary: "s", explanation: "e" },
      [
        { id: "1", nl: "Nu ga ik.", en: "Now I go." },
        { id: "2", nl: "   ", en: "" },
      ],
      "ai-assisted",
    );
    if (input.type !== "grammar") throw new Error("unreachable");
    expect(input.examples).toEqual([{ nl: "Nu ga ik.", en: "Now I go." }]);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/features/add/suggestion-to-input.test.ts`
Expected: FAIL — `Cannot find module './suggestion-to-input'`.

- [ ] **Step 3: Create `src/features/add/suggestion-to-input.ts`**

Move `parseTags`, `toNullable`, and `buildCreateInput` **verbatim** out of `add-knowledge-view.tsx` into this file, then add the two new helpers:

```ts
import type { CreateKnowledgeItemInput } from "@/server/actions/schemas";
import type { AiSuggestion, KnowledgeSource } from "@/types";

import { type AuthableType, type Example, REQUIRED, type Values } from "./types";

function parseTags(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function toNullable(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Reverse of the Add form's payload-builder — shapes the current form values
 *  into the Server Action's create input. Moved here from the view so the
 *  review checklist can reuse it for each selected row. */
export function buildCreateInput(
  type: AuthableType,
  values: Values,
  examples: Example[],
  source: KnowledgeSource,
): CreateKnowledgeItemInput {
  const shared = {
    level: (values.level || null) as CreateKnowledgeItemInput["level"],
    tags: parseTags(values.tags),
    source,
  };

  switch (type) {
    case "vocabulary":
      return {
        ...shared,
        type: "vocabulary",
        term: values.term!.trim(),
        meaning: values.meaning!.trim(),
        partOfSpeech: values.partOfSpeech!.trim(),
        example: toNullable(values.example),
        exampleTranslation: toNullable(values.exampleTranslation),
        article: values.article === "de" || values.article === "het" ? values.article : null,
        plural: toNullable(values.plural),
        pastTense: toNullable(values.pastTense),
        perfect: toNullable(values.perfect),
        usageNote: toNullable(values.usageNote),
      };
    case "grammar":
      return {
        ...shared,
        type: "grammar",
        title: values.title!.trim(),
        summary: values.summary!.trim(),
        explanation: values.explanation!.trim(),
        examples: examples
          .filter((e) => e.nl.trim().length > 0)
          .map((e) => ({ nl: e.nl.trim(), en: toNullable(e.en) })),
      };
    case "reading":
      return {
        ...shared,
        type: "reading",
        title: values.title!.trim(),
        body: values.readingBody!.trim(),
        summary: toNullable(values.summary),
      };
    case "note":
      return {
        ...shared,
        type: "note",
        title: toNullable(values.title),
        body: values.noteBody!.trim(),
      };
  }
}

/** Turn one AI suggestion into an editable review-row draft. `fields` are
 *  already keyed like the form; grammar examples get local ids. */
export function suggestionToDraft(s: AiSuggestion): {
  type: AuthableType;
  values: Values;
  examples: Example[];
} {
  return {
    type: s.type as AuthableType,
    values: { ...s.fields },
    examples: (s.examples ?? []).map((ex) => ({ id: crypto.randomUUID(), nl: ex.nl, en: ex.en })),
  };
}

/** Required field names for `type` that the draft has not filled — a non-empty
 *  result means the row must be opened in the full form before it can be saved. */
export function missingRequired(type: AuthableType, values: Values): string[] {
  return REQUIRED[type].filter((name) => !(values[name] ?? "").trim());
}
```

- [ ] **Step 4: Update `add-knowledge-view.tsx`**

- Delete the local `parseTags`, `toNullable`, and `buildCreateInput` definitions.
- Add `import { buildCreateInput } from "./suggestion-to-input";`
- Nothing else changes — `handleSubmit` still calls `buildCreateInput(type, values, examples, source)`.

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run src/features/add/suggestion-to-input.test.ts src/features/add/add-knowledge-view.test.tsx`
Expected: PASS — both.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/add/suggestion-to-input.ts src/features/add/suggestion-to-input.test.ts src/features/add/add-knowledge-view.tsx
git commit -m "refactor(phase-5): extract buildCreateInput + add draft helpers"
```

---

### Task 11: i18n keys

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/nl.json`

**Interfaces:**
- Produces new keys under `add.ai`: `mode.{text,photos}`, `photos.{pick,hint,preparing,analysing,rejectedFormat,rejectedSize,tooMany,truncated}`, `review.{title,extraFields,exampleCount,selectAll,selected,edit,remove,submit,empty,successCount,failed,needsDetails}`. Reuses existing `add.ai.submit`, `add.ai.processing`, `add.ai.reviewTitle`, `add.ai.confirm`, `add.ai.startOver`.

- [ ] **Step 1: Add the keys to `src/messages/en.json`**

Inside the existing `add.ai` object, add a `mode`, `photos`, and `review` block (keep the existing `notice` block):

```json
"mode": {
  "text": "Paste text",
  "photos": "Upload photos"
},
"photos": {
  "pick": "Choose photos (up to 3)",
  "hint": "A worksheet, textbook page, or your notes. JPEG or PNG.",
  "preparing": "Preparing photos…",
  "analysing": "Reading your photos…",
  "rejectedFormat": "Couldn't read that image. Try a JPEG or PNG.",
  "rejectedSize": "That image is over 10 MB.",
  "tooMany": "Up to 3 photos at a time.",
  "truncated": "Some items may be missing — upload a smaller section for the rest."
},
"review": {
  "title": "Review what the AI found",
  "extraFields": "+{fields}",
  "exampleCount": "{count} examples",
  "selectAll": "Select all",
  "selected": "{count} selected",
  "edit": "Edit",
  "remove": "Remove",
  "submit": "Add {count} selected",
  "empty": "Nothing selected",
  "successCount": "{count} items added",
  "failed": "Couldn't save the items. Try again.",
  "needsDetails": "Needs details"
}
```

- [ ] **Step 2: Add the same keys to `src/messages/nl.json`**

```json
"mode": {
  "text": "Tekst plakken",
  "photos": "Foto's uploaden"
},
"photos": {
  "pick": "Kies foto's (max. 3)",
  "hint": "Een werkblad, lesboekpagina of je aantekeningen. JPEG of PNG.",
  "preparing": "Foto's voorbereiden…",
  "analysing": "Je foto's lezen…",
  "rejectedFormat": "Kon die afbeelding niet lezen. Probeer een JPEG of PNG.",
  "rejectedSize": "Die afbeelding is groter dan 10 MB.",
  "tooMany": "Maximaal 3 foto's tegelijk.",
  "truncated": "Sommige items ontbreken mogelijk — upload een kleiner deel voor de rest."
},
"review": {
  "title": "Controleer wat de AI heeft gevonden",
  "extraFields": "+{fields}",
  "exampleCount": "{count} voorbeelden",
  "selectAll": "Alles selecteren",
  "selected": "{count} geselecteerd",
  "edit": "Bewerken",
  "remove": "Verwijderen",
  "submit": "{count} geselecteerde toevoegen",
  "empty": "Niets geselecteerd",
  "successCount": "{count} items toegevoegd",
  "failed": "Kon de items niet opslaan. Probeer het opnieuw.",
  "needsDetails": "Details nodig"
}
```

- [ ] **Step 3: Sanity-check both files parse**

Run: `node -e "require('./src/messages/en.json'); require('./src/messages/nl.json'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: clean / green (next-intl type augmentation, if any, picks up the new keys; no test asserts the old shape).

- [ ] **Step 5: Commit**

```bash
git add src/messages/en.json src/messages/nl.json
git commit -m "feat(phase-5): i18n for photo capture + review checklist"
```

---

### Task 12: `ReviewChecklist` component

**Files:**
- Create: `src/features/add/review-checklist.tsx`
- Test: `src/features/add/review-checklist.test.tsx`

**Interfaces:**
- Consumes: `missingRequired` (`./suggestion-to-input`); `AuthableType`, `Values`, `Example` (`./types`); `Badge`, `Button` (`@/components/ui`); `useTranslations` (`next-intl`).
- Produces:
  - `type ReviewRow = { id: string; checked: boolean; type: AuthableType; values: Values; examples: Example[] }`.
  - `ReviewChecklist(props)` — presentational; props: `{ truncated: boolean; rows: ReviewRow[]; onToggle(id: string): void; onToggleAll(checked: boolean): void; onEdit(id: string): void; onRemove(id: string): void; onSubmit(): void; submitting: boolean }`.

- [ ] **Step 1: Write the failing test**

`src/features/add/review-checklist.test.tsx`:

```ts
import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/en.json";

import { ReviewChecklist, type ReviewRow } from "./review-checklist";

const rows: ReviewRow[] = [
  { id: "1", checked: true, type: "vocabulary", values: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun", article: "de" }, examples: [] },
  { id: "2", checked: false, type: "grammar", values: { title: "V2", summary: "", explanation: "verb second" }, examples: [] },
  { id: "3", checked: true, type: "note", values: { noteBody: "ask about er" }, examples: [] },
];

function setup(over: Partial<Parameters<typeof ReviewChecklist>[0]> = {}) {
  const props = {
    truncated: false,
    rows,
    onToggle: vi.fn(),
    onToggleAll: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onSubmit: vi.fn(),
    submitting: false,
    ...over,
  };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewChecklist {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

describe("ReviewChecklist", () => {
  it("renders one row per item with a per-type preview", () => {
    setup();
    expect(screen.getByText("de fiets — the bike")).toBeInTheDocument();
    expect(screen.getByText("V2")).toBeInTheDocument();
    expect(screen.getByText("ask about er")).toBeInTheDocument();
  });

  it("marks a row missing a required field as needing details and disables its checkbox", () => {
    setup();
    expect(screen.getByText("Needs details")).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    // row 2 (grammar, no summary) is the one disabled
    expect(checkboxes.some((c) => (c as HTMLInputElement).disabled)).toBe(true);
  });

  it("counts only checked rows in the submit label", () => {
    setup();
    expect(screen.getByRole("button", { name: "Add 2 selected" })).toBeInTheDocument();
  });

  it("disables submit when nothing is checked", () => {
    setup({ rows: rows.map((r) => ({ ...r, checked: false })) });
    expect(screen.getByRole("button", { name: /Add 0 selected/ })).toBeDisabled();
  });

  it("fires onSubmit", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add 2 selected" }));
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it("shows the truncation notice when truncated", () => {
    setup({ truncated: true });
    expect(
      screen.getByText("Some items may be missing — upload a smaller section for the rest."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/features/add/review-checklist.test.tsx`
Expected: FAIL — `Cannot find module './review-checklist'`.

- [ ] **Step 3: Write `src/features/add/review-checklist.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";

import { Badge, Button } from "@/components/ui";

import { missingRequired } from "./suggestion-to-input";
import type { AuthableType, Example, Values } from "./types";

export type ReviewRow = {
  id: string;
  checked: boolean;
  type: AuthableType;
  values: Values;
  examples: Example[];
};

const VOCAB_EXTRAS = ["article", "plural", "pastTense", "perfect", "example", "usageNote"] as const;

function preview(row: ReviewRow): string {
  const v = row.values;
  switch (row.type) {
    case "vocabulary":
      return [v.term, v.meaning].filter(Boolean).join(" — ");
    case "grammar":
    case "reading":
      return v.title ?? "";
    case "note":
      return (v.title && v.title.trim()) || (v.noteBody ?? "").trim().slice(0, 60);
  }
}

export function ReviewChecklist({
  truncated,
  rows,
  onToggle,
  onToggleAll,
  onEdit,
  onRemove,
  onSubmit,
  submitting,
}: {
  truncated: boolean;
  rows: ReviewRow[];
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const t = useTranslations("add.ai.review");
  const tType = useTranslations("knowledge.type");
  const tPhotos = useTranslations("add.ai.photos");

  const selectedCount = rows.filter((r) => r.checked).length;
  const allSelectable = rows.filter((r) => missingRequired(r.type, r.values).length === 0);
  const allChecked = allSelectable.length > 0 && allSelectable.every((r) => r.checked);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label font-medium text-fg-secondary">{t("title")}</span>
        <label className="flex items-center gap-2 text-caption text-fg-muted">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => onToggleAll(e.target.checked)}
          />
          {t("selectAll")}
        </label>
      </div>

      {truncated ? (
        <p className="rounded-lg bg-warning-subtle p-3 text-body-sm text-warning-strong">
          {tPhotos("truncated")}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const missing = missingRequired(row.type, row.values);
          const needsDetails = missing.length > 0;
          const extras =
            row.type === "vocabulary"
              ? VOCAB_EXTRAS.filter((k) => (row.values[k] ?? "").trim().length > 0)
              : [];
          return (
            <li
              key={row.id}
              className="flex items-start gap-3 rounded-lg border border-border p-3"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={row.checked}
                disabled={needsDetails}
                onChange={() => onToggle(row.id)}
                aria-label={preview(row)}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.type === "note" ? "neutral" : row.type} size="sm">
                    {tType(row.type)}
                  </Badge>
                  <span className="truncate text-body-sm text-fg-primary">{preview(row)}</span>
                </div>
                {extras.length > 0 ? (
                  <span className="text-caption text-fg-muted">
                    {t("extraFields", { fields: extras.join(", ") })}
                  </span>
                ) : null}
                {row.type === "grammar" ? (
                  <span className="text-caption text-fg-muted">
                    {t("exampleCount", { count: row.examples.length })}
                  </span>
                ) : null}
                {needsDetails ? (
                  <span className="text-caption font-medium text-warning-strong">
                    {t("needsDetails")}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row.id)}>
                  {t("edit")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(row.id)}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        size="md"
        onClick={onSubmit}
        disabled={selectedCount === 0 || submitting}
      >
        {t("submit", { count: selectedCount })}
      </Button>
    </div>
  );
}
```

`Button` supports `variant="ghost"` and `size="sm"` (verified in `src/components/ui/button.tsx`) — the code above is valid as written. `Badge`'s `tone` accepts `"vocabulary" | "grammar" | "reading" | "file" | "neutral"` (no `"note"`), which is why note rows pass `tone="neutral"`.

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run src/features/add/review-checklist.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/add/review-checklist.tsx src/features/add/review-checklist.test.tsx
git commit -m "feat(phase-5): ReviewChecklist component"
```

---

### Task 13: `PhotoCapturePanel` + mode toggle in `ai-capture-box`

**Files:**
- Create: `src/features/add/photo-capture-panel.tsx`
- Test: `src/features/add/photo-capture-panel.test.tsx`
- Modify: `src/features/add/ai-capture-box.tsx` (add the Paste text / Upload photos toggle)

**Interfaces:**
- Produces:
  - `PhotoCapturePanel(props)` — props: `{ onStructure(files: File[]): void; busy: boolean }`. Owns file selection, per-file size/type rejection (≤ 10 MB, `image/*` or a `.heic`/`.heif` extension), the ≤ 3 cap, a thumbnail strip with remove, and the "Structure with AI" button. Emits the accepted `File[]` via `onStructure`.
  - `ai-capture-box.tsx`: `AiCaptureBox` gains props `{ photosEnabled: boolean; onStructurePhotos(files: File[]): void; photosBusy: boolean }` alongside the existing text props. When `photosEnabled`, it shows a two-option toggle and renders either the existing textarea UI or `<PhotoCapturePanel>`.

- [ ] **Step 1: Write the failing test**

`src/features/add/photo-capture-panel.test.tsx`:

```ts
import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/en.json";

import { PhotoCapturePanel } from "./photo-capture-panel";

function setup(over: Partial<Parameters<typeof PhotoCapturePanel>[0]> = {}) {
  const props = { onStructure: vi.fn(), busy: false, ...over };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PhotoCapturePanel {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

const jpeg = (name = "a.jpg", size = 1000) =>
  new File([new Uint8Array(size)], name, { type: "image/jpeg" });

describe("PhotoCapturePanel", () => {
  it("disables the submit button until at least one photo is chosen", () => {
    setup();
    expect(screen.getByRole("button", { name: "Structure with AI" })).toBeDisabled();
  });

  it("accepts up to 3 photos and passes them to onStructure", async () => {
    const props = setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [jpeg("a.jpg"), jpeg("b.jpg")]);
    await userEvent.click(screen.getByRole("button", { name: "Structure with AI" }));
    expect(props.onStructure).toHaveBeenCalledWith([expect.any(File), expect.any(File)]);
  });

  it("rejects a 4th photo with a message", async () => {
    setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [jpeg("a"), jpeg("b"), jpeg("c"), jpeg("d")]);
    expect(screen.getByText("Up to 3 photos at a time.")).toBeInTheDocument();
  });

  it("rejects an oversized file", async () => {
    setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [jpeg("big.jpg", 11 * 1024 * 1024)]);
    expect(screen.getByText("That image is over 10 MB.")).toBeInTheDocument();
  });

  it("rejects a non-image file", async () => {
    setup();
    const input = screen.getByLabelText("Choose photos (up to 3)");
    await userEvent.upload(input, [new File(["x"], "notes.txt", { type: "text/plain" })]);
    expect(screen.getByText("Couldn't read that image. Try a JPEG or PNG.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npx vitest run src/features/add/photo-capture-panel.test.tsx`
Expected: FAIL — `Cannot find module './photo-capture-panel'`.

- [ ] **Step 3: Write `src/features/add/photo-capture-panel.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field } from "@/components/ui";

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;

function isImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  return ext === "heic" || ext === "heif";
}

/** Pick 1–3 photos, validate size/type, hand the accepted `File[]` up. The
 *  parent view downscales, uploads to Storage, and calls the extract action. */
export function PhotoCapturePanel({
  onStructure,
  busy,
}: {
  onStructure: (files: File[]) => void;
  busy: boolean;
}) {
  const t = useTranslations("add.ai");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(picked)) {
      if (next.length >= MAX_FILES) {
        setError(t("photos.tooMany"));
        break;
      }
      if (!isImage(file)) {
        setError(t("photos.rejectedFormat"));
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(t("photos.rejectedSize"));
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (i: number) => setFiles((f) => f.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ai-border bg-ai-subtle p-4 sm:p-5">
      <Field label={t("photos.pick")} htmlFor="photo-capture">
        <input
          ref={inputRef}
          id="photo-capture"
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => add(e.target.files)}
          className="text-body-sm"
        />
      </Field>
      <p className="text-caption text-fg-muted">{t("photos.hint")}</p>

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-caption"
            >
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t("removeAttachment")}
                disabled={busy}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-caption text-error-strong">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          size="md"
          onClick={() => onStructure(files)}
          disabled={busy || files.length === 0}
        >
          <Sparkles className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("submit")}
        </Button>
        <p className="max-w-md text-caption text-fg-muted">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the toggle to `ai-capture-box.tsx`**

Rework `AiCaptureBox` so it renders a mode toggle when `photosEnabled` and switches between the existing textarea block and `<PhotoCapturePanel>`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field, Textarea } from "@/components/ui";

import { PhotoCapturePanel } from "./photo-capture-panel";

export function AiCaptureBox({
  value,
  onChange,
  autoFocus,
  onSubmit,
  photosEnabled = false,
  onStructurePhotos,
  photosBusy = false,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onSubmit: () => void;
  photosEnabled?: boolean;
  onStructurePhotos?: (files: File[]) => void;
  photosBusy?: boolean;
}) {
  const t = useTranslations("add.ai");
  const boxRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"text" | "photos">("text");

  useEffect(() => {
    if (autoFocus) boxRef.current?.scrollIntoView({ block: "center" });
  }, [autoFocus]);

  const textPanel = (
    <div
      ref={boxRef}
      className="flex flex-col gap-3 rounded-card border border-ai-border bg-ai-subtle p-4 sm:p-5"
    >
      <Field label={t("captureLabel")} htmlFor="ai-capture">
        <Textarea
          id="ai-capture"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("capturePlaceholder")}
          rows={4}
          className="bg-surface"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" size="md" onClick={onSubmit} disabled={value.trim().length === 0}>
          <Sparkles className="-ml-0.5 size-[18px]" strokeWidth={2} aria-hidden />
          {t("submit")}
        </Button>
        <p className="max-w-md text-caption text-fg-muted">{t("disclaimer")}</p>
      </div>
    </div>
  );

  if (!photosEnabled || !onStructurePhotos) return textPanel;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-pill bg-surface-sunken p-1 text-label">
        <button
          type="button"
          onClick={() => setTab("text")}
          className={tab === "text" ? "rounded-pill bg-surface px-3 py-1 font-medium" : "px-3 py-1 text-fg-muted"}
        >
          {t("mode.text")}
        </button>
        <button
          type="button"
          onClick={() => setTab("photos")}
          className={tab === "photos" ? "rounded-pill bg-surface px-3 py-1 font-medium" : "px-3 py-1 text-fg-muted"}
        >
          {t("mode.photos")}
        </button>
      </div>
      {tab === "text" ? (
        textPanel
      ) : (
        <PhotoCapturePanel onStructure={onStructurePhotos} busy={photosBusy} />
      )}
    </div>
  );
}
```

(The `autoFocus` prop stays wired to the text panel — no behaviour change for the existing "add" shortcut.)

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run src/features/add/photo-capture-panel.test.tsx src/features/add/add-knowledge-view.test.tsx`
Expected: PASS — `add-knowledge-view.test.tsx` still green (it renders `AiCaptureBox` without the new props, so it falls through to `textPanel`).

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/add/photo-capture-panel.tsx src/features/add/photo-capture-panel.test.tsx src/features/add/ai-capture-box.tsx
git commit -m "feat(phase-5): photo capture panel + capture-box mode toggle"
```

---

### Task 14: Wire the view — photo flow, review-list mode, edit-row

**Files:**
- Modify: `src/features/add/add-knowledge-view.tsx`
- Modify: `src/features/add/ai-review-banner.tsx` (add a `truncated` prop)
- Modify: `src/app/(app)/add/page.tsx` (async; pass `userId`)
- Test: `src/features/add/add-knowledge-view.test.tsx` (extend)

**Interfaces:**
- Consumes: `extractFromPhotosAction` (`@/server/actions/ai`), `createKnowledgeItemsAction` (`@/server/actions/knowledge`), `downscaleImage` + `ImageDecodeError` (`./downscale-image`), `createBrowserSupabaseClient` (`@/lib/supabase/browser`), `CAPTURE_BUCKET` (`@/lib/supabase/constants`), `ReviewChecklist` + `ReviewRow` (`./review-checklist`), `suggestionToDraft` + `missingRequired` (`./suggestion-to-input`).
- Produces: `AddKnowledgeView` gains an optional `userId?: string` prop; a new `"review-list"` mode and an edit-row sub-flow.

- [ ] **Step 1: Read the Next.js page-component doc**

Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — confirm an `async` default-export page component is supported and how it receives no props here. Note anything relevant in your commit if a deprecation applies.

- [ ] **Step 2: Write the failing tests**

Extend `src/features/add/add-knowledge-view.test.tsx`. Add to the mocks:

```ts
vi.mock("@/server/actions/ai", () => ({
  structureKnowledgeAction: vi.fn(),
  extractFromPhotosAction: vi.fn(),
}));
vi.mock("@/server/actions/knowledge", () => ({
  createKnowledgeItemAction: vi.fn(),
  createKnowledgeItemsAction: vi.fn(),
  updateKnowledgeItemAction: vi.fn(),
}));
vi.mock("./downscale-image", () => ({
  downscaleImage: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" })),
  ImageDecodeError: class ImageDecodeError extends Error {},
}));
vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    storage: {
      from: () => ({ upload: vi.fn().mockResolvedValue({ data: { path: "u1/x.jpg" }, error: null }) }),
    },
  }),
}));

import { extractFromPhotosAction } from "@/server/actions/ai";
import { createKnowledgeItemsAction } from "@/server/actions/knowledge";
```

Add tests:

```ts
it("shows the photo mode toggle when aiEnabled and userId are set", () => {
  render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
  expect(screen.getByRole("button", { name: "add.ai.mode.photos" })).toBeInTheDocument();
});

it("renders the review checklist after a successful photo extraction", async () => {
  vi.mocked(extractFromPhotosAction).mockResolvedValue({
    ok: true,
    data: {
      truncated: false,
      items: [
        { type: "vocabulary", fields: { term: "de fiets", meaning: "the bike", partOfSpeech: "noun" } },
        { type: "note", fields: { title: "", noteBody: "ask about er" } },
      ],
    },
  });

  render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
  fireEvent.click(screen.getByRole("button", { name: "add.ai.mode.photos" }));
  await userEvent.upload(
    screen.getByLabelText("add.ai.photos.pick"),
    new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /add\.ai\.review\.submit/ })).toBeInTheDocument();
  });
});

it("bulk-saves the checked rows and shows the success panel", async () => {
  vi.mocked(extractFromPhotosAction).mockResolvedValue({
    ok: true,
    data: { truncated: false, items: [{ type: "note", fields: { title: "", noteBody: "n1" } }] },
  });
  vi.mocked(createKnowledgeItemsAction).mockResolvedValue({ ok: true, data: { ids: ["a"] } });

  render(<AddKnowledgeView aiEnabled userId="11111111-1111-1111-1111-111111111111" />);
  fireEvent.click(screen.getByRole("button", { name: "add.ai.mode.photos" }));
  await userEvent.upload(
    screen.getByLabelText("add.ai.photos.pick"),
    new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "add.ai.submit" }));

  const save = await screen.findByRole("button", { name: /add\.ai\.review\.submit/ });
  fireEvent.click(save);

  await waitFor(() => expect(createKnowledgeItemsAction).toHaveBeenCalled());
});
```

(`useTranslations` is the namespace-aware stub in this file, so labels read like `add.ai.mode.photos` and `add.ai.review.submit`. Keep assertions on those strings.)

- [ ] **Step 3: Run it, expect failure**

Run: `npx vitest run src/features/add/add-knowledge-view.test.tsx`
Expected: FAIL — no photo toggle, no review-list.

- [ ] **Step 4: Add the `truncated` prop to `ai-review-banner.tsx`**

```tsx
export function AiReviewBanner({ noticeKey, truncated }: { noticeKey?: string; truncated?: boolean }) {
  const t = useTranslations("add.ai");
  const notice = noticeKey ? t(`notice.${noticeKey}` as Parameters<typeof t>[0]) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-ai-border bg-ai-subtle p-4">
      <span className="inline-flex items-center gap-1.5 text-label font-medium text-ai">
        <Sparkles className="size-4" strokeWidth={2} aria-hidden />
        {t("reviewTitle")}
      </span>
      {truncated ? <p className="text-body-sm text-warning-strong">{t("photos.truncated")}</p> : null}
      {notice ? <p className="text-body-sm text-fg-secondary">{notice}</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Wire `add-knowledge-view.tsx`**

Add state and handlers. Key changes:

- Prop: `export function AddKnowledgeView({ existingItem, aiEnabled = false, userId }: { existingItem?: KnowledgeItem; aiEnabled?: boolean; userId?: string } = {})`.
- `type Mode = "manual" | "processing" | "review" | "failed" | "review-list" | "review-edit";`
- New state:

```ts
const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
const [truncated, setTruncated] = useState(false);
const [editingRowId, setEditingRowId] = useState<string | null>(null);
const [batchError, setBatchError] = useState<string | null>(null);
```

- Photo submit handler (passed to `AiCaptureBox` as `onStructurePhotos`):

```ts
const runPhotoAi = async (files: File[]) => {
  if (!userId || files.length === 0) return;
  setMode("processing");
  try {
    const supabase = createBrowserSupabaseClient();
    const bucket = supabase.storage.from(CAPTURE_BUCKET);
    const paths: string[] = [];
    for (const file of files) {
      const blob = await downscaleImage(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      paths.push(path);
    }

    const result = await extractFromPhotosAction(paths);
    if (!result.ok || result.data.items.length === 0) {
      setMode("failed");
      return;
    }

    const rows: ReviewRow[] = result.data.items.map((s) => {
      const draft = suggestionToDraft(s);
      return { id: crypto.randomUUID(), checked: true, ...draft };
    });
    // rows missing a required field can't be checked until edited
    for (const row of rows) {
      if (missingRequired(row.type, row.values).length > 0) row.checked = false;
    }
    setReviewRows(rows);
    setTruncated(result.data.truncated);
    setBatchError(null);
    setMode("review-list");
  } catch {
    setMode("failed");
  }
};
```

- Checklist callbacks:

```ts
const toggleRow = (id: string) =>
  setReviewRows((rs) => rs.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
const toggleAllRows = (checked: boolean) =>
  setReviewRows((rs) =>
    rs.map((r) => (missingRequired(r.type, r.values).length > 0 ? r : { ...r, checked })),
  );
const removeRow = (id: string) => setReviewRows((rs) => rs.filter((r) => r.id !== id));

const editRow = (id: string) => {
  const row = reviewRows.find((r) => r.id === id);
  if (!row) return;
  setEditingRowId(id);
  setType(row.type);
  setValues(row.values);
  setExamples(row.examples);
  setErrors({});
  setMode("review-edit");
};

const saveBatch = async () => {
  const selected = reviewRows.filter((r) => r.checked);
  if (selected.length === 0) return;
  setSaving(true);
  setBatchError(null);
  try {
    const inputs = selected.map((r) => buildCreateInput(r.type, r.values, r.examples, "ai-assisted"));
    const result = await createKnowledgeItemsAction(inputs);
    if (!result.ok) {
      setBatchError(t("ai.review.failed"));
      return;
    }
    setSavedTitle(t("ai.review.successCount", { count: result.data.ids.length }));
  } catch {
    setBatchError(t("ai.review.failed"));
  } finally {
    setSaving(false);
  }
};
```

- The edit-row save: reuse `handleSubmit`'s required-field validation block, but when `mode === "review-edit"` write back into the row instead of calling a Server Action. Simplest: branch at the top of `handleSubmit`:

```ts
if (mode === "review-edit" && editingRowId) {
  e.preventDefault();
  const required = REQUIRED[type as AuthableType];
  const nextErrors: Errors = {};
  for (const name of required) {
    if (!(values[name] ?? "").trim()) {
      const labelKey = LABEL_KEY[name] as Parameters<typeof t>[0];
      nextErrors[name] = t("required", { field: t(labelKey) });
    }
  }
  if (Object.keys(nextErrors).length > 0) {
    setErrors(nextErrors);
    return;
  }
  setReviewRows((rs) =>
    rs.map((r) =>
      r.id === editingRowId
        ? { ...r, type: type as AuthableType, values, examples, checked: true }
        : r,
    ),
  );
  setEditingRowId(null);
  resetFields();
  setMode("review-list");
  return;
}
```

- Render: add two branches to the mode ladder, before the final `else`:

```tsx
) : mode === "review-list" ? (
  <div className="flex flex-col gap-6">
    <AiReviewBanner truncated={truncated} />
    {batchError ? <p className="text-body-sm text-error-strong">{batchError}</p> : null}
    <ReviewChecklist
      truncated={truncated}
      rows={reviewRows}
      onToggle={toggleRow}
      onToggleAll={toggleAllRows}
      onEdit={editRow}
      onRemove={removeRow}
      onSubmit={saveBatch}
      submitting={saving}
    />
  </div>
) : mode === "review-edit" ? (
  <div className="flex flex-col gap-6">
    <AiReviewBanner />
    {form(t("ai.confirm"), (
      <Button type="button" variant="ghost" size="md" onClick={() => { setEditingRowId(null); resetFields(); setMode("review-list"); }}>
        {t("ai.startOver")}
      </Button>
    ))}
  </div>
```

- Wire `AiCaptureBox` in the final branch:

```tsx
<AiCaptureBox
  value={rawText}
  onChange={setRawText}
  onSubmit={runAi}
  photosEnabled={Boolean(userId)}
  onStructurePhotos={runPhotoAi}
  photosBusy={mode === "processing"}
/>
```

- `afterSuccess` also clears the new state: `setReviewRows([]); setTruncated(false); setEditingRowId(null); setBatchError(null);`

- [ ] **Step 6: Make the add page async**

`src/app/(app)/add/page.tsx`:

```tsx
import { Suspense } from "react";

import { isAiConfigured } from "@/ai/providers/config";
import { titleMetadata } from "@/lib/page-metadata";
import { resolveActiveContext } from "@/server/services/session-service";
import { AddKnowledgeView } from "@/features/add";

export const generateMetadata = titleMetadata((t) => t("nav.add"));

export default async function AddKnowledgePage() {
  const ctx = await resolveActiveContext();
  const userId = ctx.status === "ok" ? ctx.user.id : undefined;
  return (
    <Suspense>
      <AddKnowledgeView aiEnabled={isAiConfigured()} userId={userId} />
    </Suspense>
  );
}
```

(`resolveActiveContext` is memoized per request via React `cache()` — the `(app)` layout already calls it, so this adds no round trip.)

- [ ] **Step 7: Run the affected suites**

Run: `npx vitest run src/features/add/add-knowledge-view.test.tsx src/features/add/review-checklist.test.tsx src/features/add/photo-capture-panel.test.tsx`
Expected: PASS — all.

- [ ] **Step 8: Typecheck + lint + full test run**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean / green.

- [ ] **Step 9: Commit**

```bash
git add src/features/add/add-knowledge-view.tsx src/features/add/add-knowledge-view.test.tsx src/features/add/ai-review-banner.tsx "src/app/(app)/add/page.tsx"
git commit -m "feat(phase-5): wire photo capture + review checklist into the Add view"
```

---

### Task 15: Cron sweep route + env + config

**Files:**
- Create: `src/app/api/cron/sweep-capture-staging/route.ts`
- Test: `src/app/api/cron/sweep-capture-staging/route.test.ts`
- Modify: `src/server/env.ts` (add `cronSecret`)
- Create: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `serverEnv.cronSecret`, `createAdminSupabaseClient` (`@/server/auth/supabase`), `CAPTURE_BUCKET`.
- Produces: `GET /api/cron/sweep-capture-staging` — `401` without the bearer secret, `503` when `CRON_SECRET` is unset, otherwise deletes `CAPTURE_BUCKET` objects older than 1 hour and returns `{ deleted: number }`.

- [ ] **Step 1: Read the Next.js route-handler doc**

Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — confirm the `export async function GET(request: Request)` signature and header access. Note any deprecation.

- [ ] **Step 2: Add `cronSecret` to `env.ts`**

In `src/server/env.ts`, inside the `serverEnv` object:

```ts
  get cronSecret() {
    return required("CRON_SECRET");
  },
```

(Required — the route turns a missing value into a `503` by catching the throw; see below.)

- [ ] **Step 3: Write the failing test**

`src/app/api/cron/sweep-capture-staging/route.test.ts`:

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminSupabaseClient } = vi.hoisted(() => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/server/auth/supabase", () => ({ createAdminSupabaseClient }));

import { GET } from "./route";

function req(secret?: string) {
  return new Request("https://app/api/cron/sweep-capture-staging", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

const OLD = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const FRESH = new Date().toISOString();

function fakeStorage(objects: { name: string; created_at: string }[]) {
  const remove = vi.fn().mockResolvedValue({ data: [], error: null });
  const list = vi.fn().mockResolvedValue({ data: objects, error: null });
  return { client: { storage: { from: () => ({ list, remove }) } }, list, remove };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  createAdminSupabaseClient.mockReset();
});

describe("GET /api/cron/sweep-capture-staging", () => {
  it("401s without the bearer secret", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("401s with the wrong secret", async () => {
    const res = await GET(req("nope"));
    expect(res.status).toBe(401);
  });

  it("503s when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(req("anything"));
    expect(res.status).toBe(503);
  });

  it("deletes only objects older than one hour", async () => {
    const s = fakeStorage([
      { name: "u1/old.jpg", created_at: OLD },
      { name: "u1/fresh.jpg", created_at: FRESH },
    ]);
    createAdminSupabaseClient.mockReturnValue(s.client);

    const res = await GET(req("s3cret"));

    expect(res.status).toBe(200);
    expect(s.remove).toHaveBeenCalledWith(["u1/old.jpg"]);
    expect(await res.json()).toEqual({ deleted: 1 });
  });

  it("returns deleted: 0 and does not call remove when nothing is stale", async () => {
    const s = fakeStorage([{ name: "u1/fresh.jpg", created_at: FRESH }]);
    createAdminSupabaseClient.mockReturnValue(s.client);
    const res = await GET(req("s3cret"));
    expect(s.remove).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ deleted: 0 });
  });
});
```

- [ ] **Step 4: Run it, expect failure**

Run: `npx vitest run src/app/api/cron/sweep-capture-staging/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 5: Write the route**

`src/app/api/cron/sweep-capture-staging/route.ts`:

```ts
import { CAPTURE_BUCKET } from "@/lib/supabase/constants";
import { createAdminSupabaseClient } from "@/server/auth/supabase";

const MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Hourly backstop that deletes any AI-capture staging photo older than an hour.
 * `extractFromPhotosAction` deletes them inline on every exit path; this only
 * catches objects orphaned when the browser tab closed mid-flow.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. A missing
 * `CRON_SECRET` is a deploy misconfiguration → 503 (fail loud, sweep nothing).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const bucket = supabase.storage.from(CAPTURE_BUCKET);

  const { data, error } = await bucket.list("", { limit: 1000 });
  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  const stale = (data ?? [])
    .filter((o) => o.created_at != null && new Date(o.created_at).getTime() < cutoff)
    .map((o) => o.name);

  if (stale.length > 0) {
    await bucket.remove(stale);
  }
  return Response.json({ deleted: stale.length });
}
```

Note: Supabase Storage `list("")` returns only the top level — the staging bucket is nested one folder deep (`{userId}/`). If `list("")` returns folders rather than files in this setup, the route must list per folder. **During implementation, verify the actual shape**: if `list("")` yields folder entries (no `created_at`), iterate them and `list(folder.name, ...)` for the files, prefixing `name` with `${folder.name}/` before the age filter and `remove`. Adjust the code and add a test row for the nested case if so. Keep the flat version if `list("")` (recursive-ish) already returns the files.

- [ ] **Step 6: Run tests, expect pass**

Run: `npx vitest run src/app/api/cron/sweep-capture-staging/route.test.ts`
Expected: PASS.

- [ ] **Step 7: Add `vercel.json`**

Create `vercel.json` at the repo root:

```json
{
  "crons": [
    { "path": "/api/cron/sweep-capture-staging", "schedule": "0 * * * *" }
  ]
}
```

- [ ] **Step 8: Update `.env.example`**

Add, after the `# --- AI (Backend Phase 4) ---` block:

```
# --- Cron (Backend Phase 5) ---
# Shared secret Vercel Cron sends as `Authorization: Bearer …`. Required in
# production; the staging-bucket sweep route (/api/cron/sweep-capture-staging)
# returns 503 without it. Any long random string.
CRON_SECRET=
```

- [ ] **Step 9: Typecheck + lint + full test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: clean / green.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/cron/sweep-capture-staging/route.ts src/app/api/cron/sweep-capture-staging/route.test.ts src/server/env.ts vercel.json .env.example
git commit -m "feat(phase-5): hourly staging-bucket sweep cron"
```

---

### Task 16: Operator runbook + full verification

**Files:**
- Create: `docs/supabase-storage-capture.md`
- Modify: `docs/superpowers/specs/2026-09-08-backend-phase-5-ai-photo-capture-design.md` (Status line)

- [ ] **Step 1: Write the Supabase setup runbook**

`docs/supabase-storage-capture.md` — the manual, out-of-band steps the project owner runs in the Supabase dashboard (mirrors `docs/supabase-auth-email.md`):

```markdown
# AI photo capture — Supabase Storage setup (Backend Phase 5)

One private bucket backs the "Upload photos" mode on the Add-knowledge screen.
Photos live in it only for the seconds a vision call takes; they're deleted
inline and swept hourly. Nothing here is created by a migration — do it once in
the dashboard.

## 1. Bucket

Storage → New bucket:
- Name: `knowledge-capture-staging`
- Public: **off**
- Restrict file size: `2 MB`
- Allowed MIME types: `image/jpeg`

## 2. RLS policies on `storage.objects`

For `bucket_id = 'knowledge-capture-staging'`, a user may only touch files
under their own id prefix. Add three policies (SELECT, INSERT, DELETE), same
`USING` / `WITH CHECK` expression:

    (storage.foldername(name))[1] = auth.uid()::text

No UPDATE policy. The hourly sweep uses the service-role key and bypasses RLS.

## 3. Env

- `CRON_SECRET` — set on Vercel (all environments). Any long random string.
  `/api/cron/sweep-capture-staging` returns 503 without it.
- `vercel.json` already registers the hourly cron.

## 4. Feature gate

The whole AI-capture step (text and photos) stays hidden until `AI_API_KEY` is
set, exactly as in Phase 4. The bucket and cron can be created ahead of that
with no user-visible effect.
```

- [ ] **Step 2: Flip the spec Status line**

In the spec, change `**Status:** Design — not started` to `**Status:** Implemented — branch <your branch name> (Supabase bucket + RLS + CRON_SECRET owner setup pending; manual smoke pending)`.

- [ ] **Step 3: Full gate**

Run: `npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint clean, vitest all green (no new skips beyond the pre-existing DB-integration skips).

- [ ] **Step 4: Grep for stragglers**

Run: `git grep -n "TODO\|FIXME\|knowledge-capture-staging" -- src | grep -v ".test."`
Expected: `knowledge-capture-staging` appears only via the `CAPTURE_BUCKET` constant import sites; no new `TODO`/`FIXME`.

- [ ] **Step 5: Commit**

```bash
git add docs/supabase-storage-capture.md docs/superpowers/specs/2026-09-08-backend-phase-5-ai-photo-capture-design.md
git commit -m "docs(phase-5): Supabase Storage runbook + spec status"
```

---

## Manual verification (owner, after merge — needs a real session + AI key + the Supabase setup)

Not doable by an agent (magic-link inbox, live OpenAI key, dashboard access):

1. In Supabase: create the `knowledge-capture-staging` bucket + the 3 RLS policies (`docs/supabase-storage-capture.md`); set `CRON_SECRET` on Vercel.
2. Sign in, go to **Add knowledge**. Confirm the **Paste text / Upload photos** toggle shows (only when `AI_API_KEY` is set).
3. Photograph a worksheet with a vocab list **and** one grammar rule. Upload it under "Upload photos" → "Structure with AI".
4. On the checklist: one row per word plus a grammar row; types correct; a proposed level chip present; grammar row shows an example count; any row missing a required field shows "Needs details" and can't be checked until edited.
5. Deselect one row, **Edit** another (full form opens with every AI-filled field), save it back, then **Add N selected**.
6. Success panel shows the right count. Open **Library / Today** → the items are there with `source` = ai-assisted.
7. In Supabase Storage → `knowledge-capture-staging` is empty (deleted inline).
8. Hit `/api/cron/sweep-capture-staging` with `Authorization: Bearer <CRON_SECRET>` → `{ "deleted": 0 }` and `200`; without the header → `401`.
9. NL/EN: flip the language toggle on the checklist and capture box — all new strings translate.

---

## Self-Review

**Spec coverage**

| Spec section | Task(s) |
| --- | --- |
| §2 photos-only, 1–3 images, 10 MB, downscale ≤1600px q0.82 | 9 (`downscaleImage`), 13 (`PhotoCapturePanel` caps + rejects) |
| §2 transient staging bucket, delete on every exit path | 6 (`finally` remove), 15 (hourly sweep), 16 (bucket/RLS runbook) |
| §2 extraction shape `{ items[] }`, cap 30, no summary | 2 (`knowledgeExtractionSchema`), 5 (service `truncated`) |
| §2 reuse `knowledgeSuggestionSchema` + `toAiSuggestion` | 2, 5 |
| §2 review checklist, all-checked default, Edit → full form, "Add N selected" | 12 (`ReviewChecklist`), 14 (wire + edit-row) |
| §2 invalid/empty rows → manual form fallback | 14 (`items.length === 0` → `failed`; per-row `missingRequired` → needs-details) |
| §2 bulk insert one transaction, all-or-nothing | 7 (`createKnowledgeItems`), 8 (action) |
| §2 third mode on the AI-capture step | 13 (toggle in `ai-capture-box`) |
| §2 `source: "ai-assisted"` | 14 (`buildCreateInput(..., "ai-assisted")`) |
| §2 missing key → whole step hidden | 14 (`photosEnabled={Boolean(userId)}` + existing `aiEnabled` gate); 5/6 return `unavailable` |
| §4 bucket config + RLS | 16 (runbook — dashboard, not code) |
| §4 lifecycle: browser upload → sign → extract → delete | 1 (browser client), 14 (upload loop), 6 (sign + delete) |
| §4 scheduled sweep + `CRON_SECRET` | 15 |
| §5 provider `images?` param, 32000 tokens | 4 |
| §5 `knowledgeExtractionSchema` | 2 |
| §5 per-type field table (extractor fills same fields as paste path) | 5 (prompt mirrors `KNOWLEDGE_PROCESSOR_PROMPT_V2`); reuse of the union in 2 |
| §5 `KNOWLEDGE_EXTRACTION_PROMPT` v1 | 5 |
| §5 `extractKnowledgeFromImages` + `ExtractResult` | 5 |
| §5 lift `ensureGrammarExamples`, run ≤3 per set | 3 (lift), 5 (`MAX_GRAMMAR_FOLLOWUPS`) |
| §5 README services row | 5 |
| §6 `capturePathsSchema` + `extractFromPhotosAction` | 6 |
| §6 `createKnowledgeItemsAction` + `createKnowledgeItems` + `buildKnowledgeRow` | 7, 8 |
| §7 `downscale-image.ts` | 9 |
| §7 `ai-capture-box` toggle | 13 |
| §7 `add-knowledge-view` `review-list` + edit-row | 14 |
| §7 pass `userId` from the page | 14 |
| §7 `ai-review-banner` truncated | 14 |
| §8 `ReviewChecklist` (no summary; extras hint; example count; needs-details) | 12 |
| §9 i18n keys | 11 |
| §11 `CRON_SECRET` env + `.env.example` + `vercel.json` | 15 |
| §12 test matrix | every task's test step; `knowledge.test.ts` created in 8 |
| §14 rollout / reversibility | gate behind `AI_API_KEY` (14), runbook (16) |

**Deliberate deviations from the spec**

- Spec §5 says "the `buildTextFormat` schema name becomes a parameter." Kept the existing hard-coded `"knowledge_suggestion"` string — it's only the JSON-schema `name` field, has no functional effect on any current caller, and parametrising it is pure churn. (Task 4.)
- Spec §6's `extractFromPhotosAction` sketch reads `ctx.userId`; the real `ActiveContext` shape is `ctx.user.id` behind a `ctx.status === "ok"` guard. Plan uses the real shape. (Task 6.)
- Spec §6's `createKnowledgeItemsAction` sketch calls `revalidatePath("/knowledge")` and `return toActionError(e)`. The repo's knowledge actions revalidate `/today` + `/library` and `return { ok: false, ...toActionError(e) }`. Plan matches the repo. (Task 8.)
- Spec §8 lists an `onToggleAll(checked)` that flips every row; the plan's `toggleAllRows` skips rows that are missing a required field (they can't be checked anyway). Same intent, avoids a dead toggle.
- Per-file "downscaling → uploading → done" chips (spec §7) are reduced to: per-file **rejection** messages at selection time (size/format/count) plus one combined `processing` spinner during downscale+upload. The distinction the spec cares about — telling the user *which* file is bad — is kept.

**Placeholder scan:** none — every code step carries the full content. The two "verify at implementation time" notes (Task 4's `detail`/`content`-array cast if `openai@7` types object; Task 15's flat-vs-nested `storage.list`) are genuine environment checks with the fallback spelled out, not deferred work.

**Type consistency:** `ReviewRow` defined in Task 12, imported in Task 14. `ExtractResult` / `extractKnowledgeFromImages` defined in Task 5, consumed in Task 6. `buildCreateInput` moved in Task 10, used in Task 14. `buildKnowledgeRow` / `createKnowledgeItems` defined in Task 7, used in Task 8. `capturePathsSchema` defined in Task 6. `CAPTURE_BUCKET` defined in Task 1, used in Tasks 6, 14, 15. `createBrowserSupabaseClient` defined in Task 1, used in Task 14. `AiProvider.generateStructured` `images?` param added in Task 4, used in Task 5. All names match across tasks.
