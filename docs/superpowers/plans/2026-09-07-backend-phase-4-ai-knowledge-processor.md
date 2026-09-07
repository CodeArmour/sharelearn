# Backend Phase 4 — AI Knowledge Processor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simulated `getAiSuggestion(rawText)` structuring step on the Add-knowledge screen with a real Anthropic-backed one, standing up the reserved `src/ai/` layer end-to-end.

**Architecture:** A thin `AiProvider` interface in `src/ai/providers/` wraps `@anthropic-ai/sdk` (one non-streaming `messages.parse()` structured-output call); no SDK import lives outside that directory. `src/ai/services/knowledge-processor.ts` calls the provider with a versioned prompt and a Zod schema, validates the result, and maps it into the unchanged `AiSuggestion` contract. A new `structureKnowledgeAction` Server Action is the only thing the client calls. The feature is gated on `AI_API_KEY`: absent ⇒ the provider factory returns `null`, the action returns `ai-unavailable`, and the Add screen renders the manual form alone.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Zod 4, `@anthropic-ai/sdk`, Vitest, next-intl.

**Spec:** `docs/superpowers/specs/2026-09-07-backend-phase-4-ai-knowledge-processor-design.md`

## Global Constraints

- **Provider isolation:** no `@anthropic-ai/sdk` import anywhere outside `src/ai/providers/`. Only `src/server/` and `src/ai/services/` may import from `src/ai/providers/`.
- **Every provider response is validated against an `src/ai/schemas/` schema before it reaches application code.**
- **`AI_API_KEY` is optional.** No `required()` call for it in `src/server/env.ts`. The full test suite and a fresh clone must pass/run with it unset.
- **`AiSuggestion` contract (`src/types/ai.ts`) does not change.** The five components that render the AI review form stay untouched.
- **Model default:** `claude-sonnet-5`, overridable by the `AI_MODEL` env var. Use the exact id string `claude-sonnet-5` — no date suffix.
- **`noticeKey` is a closed set:** exactly `checkTypeAndLevel`, `titleAndSummary`, `summaryAndExamples`, `meaningAndType`.
- **Input guardrail:** `z.string().trim().min(2).max(10_000)` at the action boundary — the only guardrail. No rate limiting, no spend ceiling.
- **Path alias:** `@/*` → `src/*` (so `@/ai/...` resolves with no config change).
- **Gates for every task:** `npm run typecheck` && `npm run lint` && `npm test`. `npm run format:check` is red repo-wide — ignore it; do not run `prettier --write` on files you touch.
- **Server-side unit tests** start with `// @vitest-environment node` and mock collaborators with hoisted `vi.mock("<module>", () => ({ ... }))` above the imports (`clearMocks: true` is set globally).
- **Commit after each task** once its gates are green. Conventional-commit style; end the message body with the two trailers used across this repo:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9
  ```

---

## File Structure

**New — `src/ai/`:**

| File | Responsibility |
| --- | --- |
| `src/ai/providers/types.ts` | `AiProvider` interface; `AiProviderError` class |
| `src/ai/providers/anthropic.ts` | `AnthropicProvider` — the only `@anthropic-ai/sdk` consumer |
| `src/ai/providers/index.ts` | `getAiProvider()` factory (null when unconfigured); `isAiConfigured()` |
| `src/ai/schemas/knowledge-suggestion.ts` | `knowledgeSuggestionSchema` (Zod discriminated union), `NOTICE_KEYS`, `toAiSuggestion()` mapper, `KnowledgeSuggestion` type |
| `src/ai/prompts/knowledge-processor.ts` | `KNOWLEDGE_PROCESSOR_PROMPT_V1`, `PROMPT_VERSION` |
| `src/ai/services/knowledge-processor.ts` | `structureKnowledge(rawText)` → `StructureResult` |

**New — server + tests:**

| File | Responsibility |
| --- | --- |
| `src/server/actions/ai.ts` | `structureKnowledgeAction(rawText)` Server Action |
| `src/ai/**/*.test.ts`, `src/server/actions/ai.test.ts`, `src/server/env.test.ts`, `src/features/add/add-knowledge-view.test.tsx` | unit tests |

**Modified:**

| File | Change |
| --- | --- |
| `package.json` | add `@anthropic-ai/sdk` dependency |
| `.env.example` | replace commented `AI_*` block with real (blank) `AI_API_KEY` / `AI_MODEL` |
| `src/server/env.ts` | add `aiApiKey` (nullable) + `aiModel` getters |
| `src/server/actions/schemas.ts` | add `rawKnowledgeTextSchema` |
| `src/app/(app)/add/page.tsx` | pass `aiEnabled={isAiConfigured()}` |
| `src/features/add/add-knowledge-view.tsx` | `aiEnabled` prop; `runAi` calls the action; drop attachment state + `@/data/mock` import + `?attach=` handling |
| `src/features/add/ai-capture-box.tsx` | strip to text-only (no photo/file inputs, chip, or buttons) |
| `src/features/today/components/capture-bar.tsx` | remove the two `?attach=` shortcut links |
| `src/messages/en.json`, `src/messages/nl.json` | drop the "Simulated for now." sentence from `add.ai.disclaimer` |

**Deleted:**

| File | Reason |
| --- | --- |
| `src/data/mock/index.ts` (and the now-empty `src/data/` dir) | its only two exports (`getAiSuggestion`, `getAiSuggestionFromAttachment`) are removed; `add-knowledge-view.tsx` was its sole importer |

**Deliberately left for the later multimodal slice** (tracked, not touched here): `AiAttachment` + `classifyAttachment` in `src/features/add/types.ts`; `formatFileSize` in `src/lib/utils/file-size`; the `add.ai.notice.fromPhoto|fromPdf|fromDocument` and `today.capture.photoLabel|fileLabel` i18n keys.

---

## Task 1: Dependencies & environment config

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/server/env.ts`
- Modify: `.env.example`
- Test: `src/server/env.test.ts` (create)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `serverEnv.aiApiKey: string | null` — `process.env.AI_API_KEY` trimmed, or `null` when unset/blank.
  - `serverEnv.aiModel: string` — `process.env.AI_MODEL` trimmed, or `"claude-sonnet-5"` when unset/blank.

- [ ] **Step 1: Install the SDK**

Run:
```bash
npm install @anthropic-ai/sdk
```
Expected: `package.json` `dependencies` gains `"@anthropic-ai/sdk"`; `package-lock.json` updates. No other dependency changes.

- [ ] **Step 2: Write the failing env test**

Create `src/server/env.test.ts`:
```typescript
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { serverEnv } from "./env";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("serverEnv.aiApiKey", () => {
  it("is null when AI_API_KEY is unset", () => {
    expect(serverEnv.aiApiKey).toBeNull();
  });

  it("is null when AI_API_KEY is blank/whitespace", () => {
    process.env.AI_API_KEY = "   ";
    expect(serverEnv.aiApiKey).toBeNull();
  });

  it("returns the trimmed key when set", () => {
    process.env.AI_API_KEY = "  sk-ant-test  ";
    expect(serverEnv.aiApiKey).toBe("sk-ant-test");
  });
});

describe("serverEnv.aiModel", () => {
  it("defaults to claude-sonnet-5", () => {
    expect(serverEnv.aiModel).toBe("claude-sonnet-5");
  });

  it("uses AI_MODEL when set", () => {
    process.env.AI_MODEL = "claude-opus-5";
    expect(serverEnv.aiModel).toBe("claude-opus-5");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run src/server/env.test.ts
```
Expected: FAIL — `serverEnv.aiApiKey` / `serverEnv.aiModel` are `undefined` (properties don't exist yet).

- [ ] **Step 4: Add the getters**

In `src/server/env.ts`, add a helper near `trimTrailingSlash` and two getters to the `serverEnv` object:
```typescript
function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
```
Then inside `export const serverEnv = { ... }`, after the `siteUrl` getter:
```typescript
  get aiApiKey() {
    return optional("AI_API_KEY");
  },
  get aiModel() {
    return optional("AI_MODEL") ?? "claude-sonnet-5";
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npx vitest run src/server/env.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Update `.env.example`**

In `.env.example`, delete the commented block:
```
# --- AI provider (later — provider-independent AIService) ------------------
# AI_PROVIDER="anthropic"
# AI_API_KEY=""
# AI_MODEL="claude-sonnet-5"
```
and add, just above the `# --- Supabase (Backend Phase 1) ---` line:
```
# --- AI (Backend Phase 4) ---
# Anthropic API key. OPTIONAL — when absent, the Add screen's "Structure with
# AI" box is hidden and only the manual form shows. CI runs without it.
AI_API_KEY=
# Optional model override; defaults to claude-sonnet-5.
AI_MODEL=
```

- [ ] **Step 7: Full gates**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: typecheck clean, lint clean, all tests pass (baseline 148 + 5 new env tests).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/server/env.ts src/server/env.test.ts .env.example
git commit -m "feat(ai): add @anthropic-ai/sdk dep and optional AI_API_KEY/AI_MODEL env

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 2: Knowledge-suggestion schema & `AiSuggestion` mapper

**Files:**
- Create: `src/ai/schemas/knowledge-suggestion.ts`
- Test: `src/ai/schemas/knowledge-suggestion.test.ts`

**Interfaces:**
- Consumes: `AiSuggestion` from `@/types` (`src/types/ai.ts` — `{ type: KnowledgeType; fields: Record<string,string>; examples?: { nl: string; en: string }[]; noticeKey?: string }`).
- Produces:
  - `NOTICE_KEYS` — `readonly ["checkTypeAndLevel","titleAndSummary","summaryAndExamples","meaningAndType"]`.
  - `knowledgeSuggestionSchema` — a Zod discriminated union on `type`.
  - `type KnowledgeSuggestion = z.infer<typeof knowledgeSuggestionSchema>`.
  - `toAiSuggestion(parsed: KnowledgeSuggestion): AiSuggestion`.

- [ ] **Step 1: Write the failing test**

Create `src/ai/schemas/knowledge-suggestion.test.ts`:
```typescript
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { knowledgeSuggestionSchema, toAiSuggestion } from "./knowledge-suggestion";

describe("knowledgeSuggestionSchema", () => {
  it("accepts a minimal vocabulary suggestion", () => {
    const parsed = knowledgeSuggestionSchema.parse({
      type: "vocabulary",
      term: "gezellig",
      meaning: "cozy, convivial",
    });
    expect(parsed).toMatchObject({ type: "vocabulary", term: "gezellig" });
  });

  it("rejects an out-of-set noticeKey", () => {
    const r = knowledgeSuggestionSchema.safeParse({
      type: "note",
      body: "some text",
      noticeKey: "notARealKey",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a vocabulary suggestion missing `meaning`", () => {
    const r = knowledgeSuggestionSchema.safeParse({ type: "vocabulary", term: "gezellig" });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const r = knowledgeSuggestionSchema.safeParse({ type: "flashcard", term: "x", meaning: "y" });
    expect(r.success).toBe(false);
  });
});

describe("toAiSuggestion", () => {
  it("maps vocabulary → fields keyed like the Add form", () => {
    const out = toAiSuggestion({
      type: "vocabulary",
      term: "afspreken",
      meaning: "to arrange",
      partOfSpeech: "verb",
      noticeKey: "checkTypeAndLevel",
    });
    expect(out).toEqual({
      type: "vocabulary",
      fields: { term: "afspreken", meaning: "to arrange", partOfSpeech: "verb" },
      noticeKey: "checkTypeAndLevel",
    });
  });

  it("defaults an absent vocabulary partOfSpeech to an empty string", () => {
    const out = toAiSuggestion({ type: "vocabulary", term: "x", meaning: "y" });
    expect(out.fields.partOfSpeech).toBe("");
  });

  it("maps grammar and lifts worked examples", () => {
    const out = toAiSuggestion({
      type: "grammar",
      title: "Woordvolgorde",
      explanation: "In a main clause the finite verb is second.",
      examples: [{ nl: "Ik ga morgen naar huis.", en: "I go home tomorrow." }],
    });
    expect(out).toEqual({
      type: "grammar",
      fields: {
        title: "Woordvolgorde",
        summary: "",
        explanation: "In a main clause the finite verb is second.",
      },
      examples: [{ nl: "Ik ga morgen naar huis.", en: "I go home tomorrow." }],
    });
  });

  it("maps reading body → readingBody", () => {
    const out = toAiSuggestion({ type: "reading", title: "Op de markt", body: "Het is druk..." });
    expect(out.fields).toEqual({ title: "Op de markt", readingBody: "Het is druk...", summary: "" });
  });

  it("maps note body → noteBody and defaults the title", () => {
    const out = toAiSuggestion({ type: "note", body: "Remember to ask about de/het." });
    expect(out.fields).toEqual({ title: "", noteBody: "Remember to ask about de/het." });
    expect(out.noticeKey).toBeUndefined();
  });

  it("normalises grammar example en to a string", () => {
    const out = toAiSuggestion({
      type: "grammar",
      title: "T",
      explanation: "E",
      examples: [{ nl: "Zin zonder vertaling." }],
    });
    expect(out.examples).toEqual([{ nl: "Zin zonder vertaling.", en: "" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run src/ai/schemas/knowledge-suggestion.test.ts
```
Expected: FAIL — module `./knowledge-suggestion` not found.

- [ ] **Step 3: Write the schema and mapper**

Create `src/ai/schemas/knowledge-suggestion.ts`:
```typescript
import { z } from "zod";

import type { AiSuggestion } from "@/types";

/**
 * The closed set of reviewer-hint keys the model may return. Each maps to an
 * existing `add.ai.notice.*` i18n string. Keep in sync with the schema below
 * and with `src/messages/*.json`.
 */
export const NOTICE_KEYS = [
  "checkTypeAndLevel",
  "titleAndSummary",
  "summaryAndExamples",
  "meaningAndType",
] as const;

const noticeKey = z.enum(NOTICE_KEYS).optional();

const grammarExample = z.object({
  nl: z.string().min(1),
  en: z.string().optional(),
});

/**
 * What the model must return — a discriminated union on `type`, one member per
 * authorable knowledge type. Field names match the Add form. `level` is
 * intentionally absent: the reviewer sets CEFR level, the model must not guess.
 */
export const knowledgeSuggestionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("vocabulary"),
    term: z.string().min(1),
    meaning: z.string().min(1),
    partOfSpeech: z.string().optional(),
    noticeKey,
  }),
  z.object({
    type: z.literal("grammar"),
    title: z.string().min(1),
    explanation: z.string().min(1),
    summary: z.string().optional(),
    examples: z.array(grammarExample).optional(),
    noticeKey,
  }),
  z.object({
    type: z.literal("reading"),
    title: z.string().min(1),
    body: z.string().min(1),
    summary: z.string().optional(),
    noticeKey,
  }),
  z.object({
    type: z.literal("note"),
    body: z.string().min(1),
    title: z.string().optional(),
    noticeKey,
  }),
]);

export type KnowledgeSuggestion = z.infer<typeof knowledgeSuggestionSchema>;

/**
 * Flatten a validated suggestion into the `AiSuggestion` shape the Add screen
 * already consumes: `fields` keyed exactly like the form inputs, grammar
 * worked examples lifted to `examples`, `noticeKey` passed through untouched.
 */
export function toAiSuggestion(parsed: KnowledgeSuggestion): AiSuggestion {
  switch (parsed.type) {
    case "vocabulary":
      return {
        type: "vocabulary",
        fields: {
          term: parsed.term,
          meaning: parsed.meaning,
          partOfSpeech: parsed.partOfSpeech ?? "",
        },
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
    case "grammar":
      return {
        type: "grammar",
        fields: {
          title: parsed.title,
          summary: parsed.summary ?? "",
          explanation: parsed.explanation,
        },
        examples: (parsed.examples ?? []).map((e) => ({ nl: e.nl, en: e.en ?? "" })),
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
    case "reading":
      return {
        type: "reading",
        fields: {
          title: parsed.title,
          readingBody: parsed.body,
          summary: parsed.summary ?? "",
        },
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
    case "note":
      return {
        type: "note",
        fields: { title: parsed.title ?? "", noteBody: parsed.body },
        ...(parsed.noticeKey ? { noticeKey: parsed.noticeKey } : {}),
      };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run src/ai/schemas/knowledge-suggestion.test.ts
```
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Full gates**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/ai/schemas/knowledge-suggestion.ts src/ai/schemas/knowledge-suggestion.test.ts
git commit -m "feat(ai): knowledge-suggestion schema + AiSuggestion mapper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 3: Provider interface & Anthropic adapter

**Files:**
- Create: `src/ai/providers/types.ts`
- Create: `src/ai/providers/anthropic.ts`
- Create: `src/ai/providers/index.ts`
- Test: `src/ai/providers/anthropic.test.ts`
- Test: `src/ai/providers/index.test.ts`

**Interfaces:**
- Consumes:
  - `serverEnv.aiApiKey`, `serverEnv.aiModel` (Task 1).
  - `@anthropic-ai/sdk` — `Anthropic` default export, `Anthropic.APIError`; `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`.
- Produces:
  - `interface AiProvider { readonly name: string; generateStructured<T>(opts: { system: string; user: string; schema: z.ZodType<T> }): Promise<T> }`.
  - `class AiProviderError extends Error` (constructor `(message: string, options?: { cause?: unknown })`).
  - `class AnthropicProvider implements AiProvider` (constructor `({ apiKey, model }: { apiKey: string; model: string })`).
  - `getAiProvider(): AiProvider | null` — `null` when `serverEnv.aiApiKey` is `null`.
  - `isAiConfigured(): boolean`.

- [ ] **Step 1: Write `types.ts`** (no test of its own — it is types + a one-line class)

Create `src/ai/providers/types.ts`:
```typescript
import type { z } from "zod";

/** Raised for any provider-side failure: transport error, refusal, or output
 *  that could not be parsed into the requested schema. Never let a raw SDK
 *  error escape a provider. */
export class AiProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiProviderError";
  }
}

export interface AiProvider {
  readonly name: string;
  /** Ask the model for a single structured object matching `schema`. Resolves
   *  with the parsed, schema-valid value or throws `AiProviderError`. */
  generateStructured<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
}
```

- [ ] **Step 2: Write the failing adapter test**

Create `src/ai/providers/anthropic.test.ts`:
```typescript
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    messages = { parse };
    static APIError = APIError;
  }
  return { default: Anthropic, APIError };
});

import { AiProviderError } from "./types";
import { AnthropicProvider } from "./anthropic";

const schema = z.object({ type: z.literal("note"), body: z.string() });

function provider() {
  return new AnthropicProvider({ apiKey: "sk-ant-test", model: "claude-sonnet-5" });
}

beforeEach(() => {
  parse.mockReset();
});

describe("AnthropicProvider.generateStructured", () => {
  it("calls messages.parse with the model and an output_config format, returns parsed_output", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { type: "note", body: "hi" } });

    const out = await provider().generateStructured({ system: "S", user: "U", schema });

    expect(out).toEqual({ type: "note", body: "hi" });
    const arg = parse.mock.calls[0][0];
    expect(arg.model).toBe("claude-sonnet-5");
    expect(arg.system).toBe("S");
    expect(arg.messages).toEqual([{ role: "user", content: "U" }]);
    expect(arg.output_config?.format).toBeDefined();
  });

  it("throws AiProviderError when the model refuses", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    await expect(provider().generateStructured({ system: "S", user: "U", schema })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it("throws AiProviderError when parsed_output is null", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: null });
    await expect(provider().generateStructured({ system: "S", user: "U", schema })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it("wraps a thrown SDK error as AiProviderError", async () => {
    parse.mockRejectedValue(new Error("boom"));
    await expect(provider().generateStructured({ system: "S", user: "U", schema })).rejects.toBeInstanceOf(
      AiProviderError,
    );
  });

  it("exposes a name", () => {
    expect(provider().name).toBe("anthropic");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run src/ai/providers/anthropic.test.ts
```
Expected: FAIL — `./anthropic` not found.

- [ ] **Step 4: Write the adapter**

Create `src/ai/providers/anthropic.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

import { type AiProvider, AiProviderError } from "./types";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor({ apiKey, model }: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateStructured<T>({
    system,
    user,
    schema,
  }: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
  }): Promise<T> {
    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: zodOutputFormat(schema) },
      });
    } catch (cause) {
      throw new AiProviderError(
        cause instanceof Anthropic.APIError
          ? `Anthropic request failed: ${cause.message}`
          : "Anthropic request failed",
        { cause },
      );
    }

    if (response.stop_reason === "refusal") {
      throw new AiProviderError("Anthropic declined to structure this input");
    }
    if (response.parsed_output == null) {
      throw new AiProviderError("Anthropic returned output that did not match the schema");
    }
    return response.parsed_output as T;
  }
}
```

> If the installed SDK version's `zodOutputFormat` has a different signature or import path, or `messages.parse` returns the parsed value under a different property than `parsed_output`, adjust here only — this file is the sole place that touches the SDK. Confirm against `node_modules/@anthropic-ai/sdk` (`helpers/zod`) before improvising. Do **not** move the SDK import elsewhere to work around a type error.

- [ ] **Step 5: Run the adapter test to verify it passes**

Run:
```bash
npx vitest run src/ai/providers/anthropic.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing factory test**

Create `src/ai/providers/index.test.ts`:
```typescript
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({ serverEnv: { aiApiKey: null as string | null, aiModel: "claude-sonnet-5" } }));

import { serverEnv } from "@/server/env";
import { getAiProvider, isAiConfigured } from "./index";

afterEach(() => {
  vi.mocked(serverEnv).aiApiKey = null;
});

describe("getAiProvider / isAiConfigured", () => {
  it("returns null / false when no key is configured", () => {
    expect(getAiProvider()).toBeNull();
    expect(isAiConfigured()).toBe(false);
  });

  it("returns a provider / true when a key is configured", () => {
    vi.mocked(serverEnv).aiApiKey = "sk-ant-test";
    const p = getAiProvider();
    expect(p).not.toBeNull();
    expect(p?.name).toBe("anthropic");
    expect(isAiConfigured()).toBe(true);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run:
```bash
npx vitest run src/ai/providers/index.test.ts
```
Expected: FAIL — `./index` has no such exports.

- [ ] **Step 8: Write the factory**

Create `src/ai/providers/index.ts`:
```typescript
import { serverEnv } from "@/server/env";

import { AnthropicProvider } from "./anthropic";
import type { AiProvider } from "./types";

export type { AiProvider } from "./types";
export { AiProviderError } from "./types";

/** The configured provider, or `null` when no `AI_API_KEY` is set. */
export function getAiProvider(): AiProvider | null {
  const apiKey = serverEnv.aiApiKey;
  if (!apiKey) return null;
  return new AnthropicProvider({ apiKey, model: serverEnv.aiModel });
}

/** Cheap check for callers that only need to know whether the AI path is on
 *  (e.g. a Server Component deciding whether to render the capture box).
 *  Does not construct a client or import the SDK. */
export function isAiConfigured(): boolean {
  return serverEnv.aiApiKey != null;
}
```

- [ ] **Step 9: Run the factory test to verify it passes**

Run:
```bash
npx vitest run src/ai/providers/index.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 10: Full gates**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add src/ai/providers/
git commit -m "feat(ai): AiProvider interface + Anthropic adapter + factory

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 4: The prompt

**Files:**
- Create: `src/ai/prompts/knowledge-processor.ts`
- Test: `src/ai/prompts/knowledge-processor.test.ts`

**Interfaces:**
- Consumes: `NOTICE_KEYS` from `@/ai/schemas/knowledge-suggestion` (for the doc comment only — the prompt text lists the keys literally).
- Produces:
  - `KNOWLEDGE_PROCESSOR_PROMPT_V1: string`.
  - `PROMPT_VERSION: "v1"`.

- [ ] **Step 1: Write the failing test**

Create `src/ai/prompts/knowledge-processor.test.ts`:
```typescript
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { KNOWLEDGE_PROCESSOR_PROMPT_V1, PROMPT_VERSION } from "./knowledge-processor";

describe("KNOWLEDGE_PROCESSOR_PROMPT_V1", () => {
  it("is a non-trivial string", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V1.length).toBeGreaterThan(200);
  });

  it("names all four authorable types", () => {
    for (const t of ["vocabulary", "grammar", "reading", "note"]) {
      expect(KNOWLEDGE_PROCESSOR_PROMPT_V1).toContain(t);
    }
  });

  it("instructs the model not to guess CEFR level", () => {
    expect(KNOWLEDGE_PROCESSOR_PROMPT_V1.toLowerCase()).toContain("level");
  });

  it("is versioned", () => {
    expect(PROMPT_VERSION).toBe("v1");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx vitest run src/ai/prompts/knowledge-processor.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the prompt**

Create `src/ai/prompts/knowledge-processor.ts`:
```typescript
/**
 * System prompt for the knowledge-structuring step. Bump the version and add a
 * new const (do not edit V1 in place) when the wording changes materially, so
 * failures can be attributed to a specific revision.
 */
export const PROMPT_VERSION = "v1" as const;

export const KNOWLEDGE_PROCESSOR_PROMPT_V1 = `You structure raw study material into a single library item for a Dutch-language learning app used by a small group of learners.

The learner has pasted some text. Classify it into exactly one type and extract the fields:

- vocabulary — a single word or short phrase to learn. Fields: term (the Dutch word or phrase, exactly as written), meaning (a concise English gloss), partOfSpeech (English, e.g. "noun", "verb", "adjective"; omit if unclear).
- grammar — a rule, pattern, or explanation about how Dutch works. Fields: title (a short English name for the rule), explanation (the full explanation, in English), summary (one English sentence; omit if you cannot make it genuinely useful), examples (0-4 items, each with nl = a Dutch example sentence and optionally en = its English translation).
- reading — a passage of Dutch text meant to be read. Fields: title (a short English or Dutch title), body (the passage, verbatim), summary (one or two English sentences; omit if unsure).
- note — anything else: a reminder, a question to ask a teacher, a loose observation. Fields: body (the text), title (optional short label).

Rules:
- term is always the Dutch text; meaning is always English.
- Do NOT guess the CEFR level. There is no level field — the learner sets it themselves after reviewing your suggestion.
- Keep the learner's wording. Do not translate the body of a reading or a note. Do not invent examples that were not implied by the input.
- Optionally set noticeKey to the single most useful thing the reviewer should double-check, chosen from: checkTypeAndLevel, titleAndSummary, summaryAndExamples, meaningAndType. Omit it if nothing stands out.
- Return only the structured object. No commentary.`;
```

- [ ] **Step 4: Run it to verify it passes**

Run:
```bash
npx vitest run src/ai/prompts/knowledge-processor.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Full gates**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/ai/prompts/
git commit -m "feat(ai): versioned knowledge-processor system prompt

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 5: The knowledge-processor service

**Files:**
- Create: `src/ai/services/knowledge-processor.ts`
- Test: `src/ai/services/knowledge-processor.test.ts`

**Interfaces:**
- Consumes:
  - `getAiProvider` from `@/ai/providers` (Task 3).
  - `KNOWLEDGE_PROCESSOR_PROMPT_V1`, `PROMPT_VERSION` from `@/ai/prompts/knowledge-processor` (Task 4).
  - `knowledgeSuggestionSchema`, `toAiSuggestion` from `@/ai/schemas/knowledge-suggestion` (Task 2).
  - `AiSuggestion` from `@/types`.
- Produces:
  - `type StructureResult = { status: "ok"; suggestion: AiSuggestion } | { status: "unavailable" } | { status: "error" }`.
  - `async function structureKnowledge(rawText: string): Promise<StructureResult>`.

- [ ] **Step 1: Write the failing test**

Create `src/ai/services/knowledge-processor.test.ts`:
```typescript
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateStructured = vi.fn();
const getAiProvider = vi.fn();

vi.mock("@/ai/providers", () => ({
  getAiProvider,
  AiProviderError: class AiProviderError extends Error {},
}));

import { structureKnowledge } from "./knowledge-processor";

beforeEach(() => {
  generateStructured.mockReset();
  getAiProvider.mockReset();
  getAiProvider.mockReturnValue({ name: "fake", generateStructured });
});

describe("structureKnowledge", () => {
  it("returns unavailable when no provider is configured", async () => {
    getAiProvider.mockReturnValue(null);
    expect(await structureKnowledge("de hond — the dog")).toEqual({ status: "unavailable" });
  });

  it("returns ok + a mapped AiSuggestion for a vocabulary result", async () => {
    generateStructured.mockResolvedValue({
      type: "vocabulary",
      term: "de hond",
      meaning: "the dog",
      partOfSpeech: "noun",
      noticeKey: "checkTypeAndLevel",
    });

    const result = await structureKnowledge("de hond — the dog");

    expect(result).toEqual({
      status: "ok",
      suggestion: {
        type: "vocabulary",
        fields: { term: "de hond", meaning: "the dog", partOfSpeech: "noun" },
        noticeKey: "checkTypeAndLevel",
      },
    });
  });

  it("returns error when the provider throws", async () => {
    generateStructured.mockRejectedValue(new Error("rate limited"));
    expect(await structureKnowledge("x y")).toEqual({ status: "error" });
  });

  it("returns error when the provider yields a schema-invalid object", async () => {
    generateStructured.mockResolvedValue({ type: "vocabulary", term: "only a term" });
    expect(await structureKnowledge("x y")).toEqual({ status: "error" });
  });

  it("passes the system prompt and the raw text to the provider", async () => {
    generateStructured.mockResolvedValue({ type: "note", body: "n" });
    await structureKnowledge("  some pasted text  ");
    const arg = generateStructured.mock.calls[0][0];
    expect(arg.system).toContain("Dutch-language learning");
    expect(arg.user).toContain("some pasted text");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx vitest run src/ai/services/knowledge-processor.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

Create `src/ai/services/knowledge-processor.ts`:
```typescript
import "server-only";

import { getAiProvider } from "@/ai/providers";
import { KNOWLEDGE_PROCESSOR_PROMPT_V1, PROMPT_VERSION } from "@/ai/prompts/knowledge-processor";
import {
  knowledgeSuggestionSchema,
  toAiSuggestion,
} from "@/ai/schemas/knowledge-suggestion";
import type { AiSuggestion } from "@/types";

export type StructureResult =
  | { status: "ok"; suggestion: AiSuggestion }
  | { status: "unavailable" }
  | { status: "error" };

const MAX_CHARS = 10_000;

/**
 * Turn pasted study text into a reviewable `AiSuggestion`. Never throws:
 * `unavailable` means no API key is configured, `error` means the model call
 * failed or returned something unusable. The caller always drops the reviewer
 * into a form afterwards, so a soft failure is fine.
 */
export async function structureKnowledge(rawText: string): Promise<StructureResult> {
  const provider = getAiProvider();
  if (!provider) return { status: "unavailable" };

  const user = rawText.trim().slice(0, MAX_CHARS);

  try {
    const raw = await provider.generateStructured({
      system: KNOWLEDGE_PROCESSOR_PROMPT_V1,
      user,
      schema: knowledgeSuggestionSchema,
    });

    const parsed = knowledgeSuggestionSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ai:knowledge-processor:${PROMPT_VERSION}] schema validation failed`,
        parsed.error.issues,
      );
      return { status: "error" };
    }

    return { status: "ok", suggestion: toAiSuggestion(parsed.data) };
  } catch (error) {
    console.error(`[ai:knowledge-processor:${PROMPT_VERSION}] provider error`, error);
    return { status: "error" };
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run:
```bash
npx vitest run src/ai/services/knowledge-processor.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Full gates**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/ai/services/
git commit -m "feat(ai): knowledge-processor service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 6: The Server Action

**Files:**
- Modify: `src/server/actions/schemas.ts` (add `rawKnowledgeTextSchema`)
- Create: `src/server/actions/ai.ts`
- Test: `src/server/actions/ai.test.ts`
- Test: extend `src/server/actions/schemas.test.ts` (one describe block)

**Interfaces:**
- Consumes:
  - `structureKnowledge`, `type StructureResult` from `@/ai/services/knowledge-processor` (Task 5).
  - `resolveActiveContext` from `@/server/services/session-service`.
  - `type ActionResult`, existing helpers from `./schemas`.
  - `AiSuggestion` from `@/types`.
- Produces:
  - `rawKnowledgeTextSchema` — `z.string().trim().min(2).max(10_000)`.
  - `async function structureKnowledgeAction(rawText: unknown): Promise<ActionResult<AiSuggestion>>` — failure codes `"validation" | "ai-unavailable" | "ai-error"`.

- [ ] **Step 1: Add the schema + a failing schema test**

In `src/server/actions/schemas.ts`, after the `tokenSchema` line, add:
```typescript
export const rawKnowledgeTextSchema = z
  .string()
  .trim()
  .min(2, "Paste a little more text")
  .max(10_000, "That is too long to structure at once");
```

In `src/server/actions/schemas.test.ts`, add `rawKnowledgeTextSchema` to the import list and append:
```typescript
describe("rawKnowledgeTextSchema", () => {
  it("rejects empty / whitespace / 1-char input", () => {
    for (const bad of ["", "   ", "a"]) {
      expect(rawKnowledgeTextSchema.safeParse(bad).success).toBe(false);
    }
  });
  it("rejects input longer than 10k chars", () => {
    expect(rawKnowledgeTextSchema.safeParse("x".repeat(10_001)).success).toBe(false);
  });
  it("accepts and trims a normal paste", () => {
    expect(rawKnowledgeTextSchema.parse("  de hond — the dog  ")).toBe("de hond — the dog");
  });
});
```

- [ ] **Step 2: Run the schema test to verify the new block fails then passes**

Run:
```bash
npx vitest run src/server/actions/schemas.test.ts
```
Expected: the three new assertions PASS once the schema is added (run before adding the schema to see them fail on the missing import).

- [ ] **Step 3: Write the failing action test**

Create `src/server/actions/ai.test.ts`:
```typescript
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const structureKnowledge = vi.fn();
const resolveActiveContext = vi.fn();

vi.mock("@/ai/services/knowledge-processor", () => ({ structureKnowledge }));
vi.mock("@/server/services/session-service", () => ({ resolveActiveContext }));

import { structureKnowledgeAction } from "./ai";

beforeEach(() => {
  structureKnowledge.mockReset();
  resolveActiveContext.mockReset();
  resolveActiveContext.mockResolvedValue({
    status: "ok",
    user: { id: "u1", name: "U", initials: "UU", avatarUrl: null },
    activeGroup: { id: "g1", name: "G", slug: "g" },
    membership: { groupId: "g1", userId: "u1", role: "member" },
  });
});

describe("structureKnowledgeAction", () => {
  it("rejects invalid input without calling the service", async () => {
    const r = await structureKnowledgeAction("a");
    expect(r).toEqual({ ok: false, code: "validation", message: expect.any(String) });
    expect(structureKnowledge).not.toHaveBeenCalled();
  });

  it("returns the suggestion on ok", async () => {
    structureKnowledge.mockResolvedValue({
      status: "ok",
      suggestion: { type: "note", fields: { title: "", noteBody: "hi" } },
    });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toEqual({ ok: true, data: { type: "note", fields: { title: "", noteBody: "hi" } } });
  });

  it("maps unavailable → ai-unavailable", async () => {
    structureKnowledge.mockResolvedValue({ status: "unavailable" });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toMatchObject({ ok: false, code: "ai-unavailable" });
  });

  it("maps error → ai-error", async () => {
    structureKnowledge.mockResolvedValue({ status: "error" });
    const r = await structureKnowledgeAction("de hond — the dog");
    expect(r).toMatchObject({ ok: false, code: "ai-error" });
  });

  it("passes the trimmed text to the service", async () => {
    structureKnowledge.mockResolvedValue({ status: "error" });
    await structureKnowledgeAction("   pasted material here   ");
    expect(structureKnowledge).toHaveBeenCalledWith("pasted material here");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run:
```bash
npx vitest run src/server/actions/ai.test.ts
```
Expected: FAIL — `./ai` not found.

- [ ] **Step 5: Write the action**

Create `src/server/actions/ai.ts`:
```typescript
"use server";

import { structureKnowledge } from "@/ai/services/knowledge-processor";
import { resolveActiveContext } from "@/server/services/session-service";
import type { AiSuggestion } from "@/types";

import { type ActionResult, rawKnowledgeTextSchema } from "./schemas";

/**
 * Structure pasted study text into a reviewable `AiSuggestion`. Nothing is
 * persisted — the reviewer confirms in the Add form, which then calls
 * `createKnowledgeItemAction`. Requires an active group context so an
 * unauthenticated caller can't reach the model.
 */
export async function structureKnowledgeAction(
  rawText: unknown,
): Promise<ActionResult<AiSuggestion>> {
  const parsed = rawKnowledgeTextSchema.safeParse(rawText);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await resolveActiveContext();

  const result = await structureKnowledge(parsed.data);
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.suggestion };
    case "unavailable":
      return { ok: false, code: "ai-unavailable", message: "AI structuring is not available" };
    case "error":
      return { ok: false, code: "ai-error", message: "Could not structure that — add it manually" };
  }
}
```

- [ ] **Step 6: Run the action test to verify it passes**

Run:
```bash
npx vitest run src/server/actions/ai.test.ts src/server/actions/schemas.test.ts
```
Expected: PASS.

- [ ] **Step 7: Full gates**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/server/actions/ai.ts src/server/actions/ai.test.ts src/server/actions/schemas.ts src/server/actions/schemas.test.ts
git commit -m "feat(ai): structureKnowledgeAction server action + input cap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 7: Wire the Add screen to the real action

**Files:**
- Modify: `src/app/(app)/add/page.tsx`
- Modify: `src/features/add/add-knowledge-view.tsx`
- Modify: `src/features/add/ai-capture-box.tsx`
- Modify: `src/features/today/components/capture-bar.tsx`
- Modify: `src/messages/en.json`, `src/messages/nl.json`
- Delete: `src/data/mock/index.ts` (and the empty `src/data/` directory)
- Test: `src/features/add/add-knowledge-view.test.tsx` (create)

**Interfaces:**
- Consumes: `structureKnowledgeAction` from `@/server/actions/ai` (Task 6); `isAiConfigured` from `@/ai/providers` (Task 3).
- Produces: `AddKnowledgeView` gains an `aiEnabled?: boolean` prop (default `false`).

- [ ] **Step 1: Write the failing component test**

Create `src/features/add/add-knowledge-view.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/server/actions/ai", () => ({ structureKnowledgeAction: vi.fn() }));
vi.mock("@/server/actions/knowledge", () => ({
  createKnowledgeItemAction: vi.fn(),
  updateKnowledgeItemAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { AddKnowledgeView } from "./add-knowledge-view";

describe("AddKnowledgeView", () => {
  it("hides the AI capture box when aiEnabled is false", () => {
    render(<AddKnowledgeView aiEnabled={false} />);
    expect(screen.queryByLabelText("ai.captureLabel")).not.toBeInTheDocument();
  });

  it("shows the AI capture box when aiEnabled is true", () => {
    render(<AddKnowledgeView aiEnabled />);
    expect(screen.getByLabelText("ai.captureLabel")).toBeInTheDocument();
  });
});
```

> If `render` of this client component pulls in other un-mocked modules (e.g. `@/components/ui`), add the minimal `vi.mock` needed — keep the test focused on the `aiEnabled` branch. The existing repo has no prior `.test.tsx` for `src/features`, so treat un-mocked import failures as expected setup, not a design problem.

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx vitest run src/features/add/add-knowledge-view.test.tsx
```
Expected: FAIL — `aiEnabled` prop not supported / capture box always rendered, or an import error to mock away.

- [ ] **Step 3: Simplify `ai-capture-box.tsx` to text-only**

Replace the file with:
```tsx
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, Field, Textarea } from "@/components/ui";

/** Paste raw text and hand it to the AI structuring step. */
export function AiCaptureBox({
  value,
  onChange,
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Scroll into view + focus on mount (arriving from Today's "add" shortcut). */
  autoFocus?: boolean;
  onSubmit: () => void;
}) {
  const t = useTranslations("add.ai");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) boxRef.current?.scrollIntoView({ block: "center" });
  }, [autoFocus]);

  return (
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
}
```

- [ ] **Step 4: Rewire `add-knowledge-view.tsx`**

Make these edits:

1. Delete the mock import (line ~8):
```tsx
import { getAiSuggestion, getAiSuggestionFromAttachment } from "@/data/mock";
```
and add:
```tsx
import { structureKnowledgeAction } from "@/server/actions/ai";
```

2. Remove the `AiAttachment` import from `"./types"` (leave the other named imports).

3. Change the signature to accept the prop:
```tsx
export function AddKnowledgeView({
  existingItem,
  aiEnabled = false,
}: { existingItem?: KnowledgeItem; aiEnabled?: boolean } = {}) {
```

4. Delete the `attachParam` / `autoOpen` lines (they used `useSearchParams().get("attach")`) and the `attachment` state:
```tsx
const attachParam = useSearchParams().get("attach");
const autoOpen = attachParam === "photo" || attachParam === "file" ? attachParam : undefined;
...
const [attachment, setAttachment] = useState<AiAttachment | null>(null);
```
Keep `useSearchParams` imported only if still used elsewhere — it is not, so drop it from the `next/navigation` import.

5. Replace `runAi` with:
```tsx
const runAi = async () => {
  setMode("processing");
  const result = await structureKnowledgeAction(rawText);
  if (!result.ok) {
    setMode("failed");
    return;
  }
  const suggestion = result.data;
  setType(suggestion.type as PickerType);
  setValues(suggestion.fields);
  setExamples((suggestion.examples ?? []).map((ex) => ({ id: crypto.randomUUID(), ...ex })));
  setErrors({});
  setNoticeKey(suggestion.noticeKey);
  setMode("review");
};
```

6. In `handleSubmit`, simplify the `source` line (no attachment branch):
```tsx
const source: KnowledgeSource = mode !== "review" ? "manual" : "ai-assisted";
```

7. In the JSX, gate the capture box on `aiEnabled` and drop attachment props. The `else` branch that renders `<AiCaptureBox .../>` becomes:
```tsx
) : (
  <div className="flex flex-col gap-6">
    {!isEditing && aiEnabled ? (
      <>
        <AiCaptureBox value={rawText} onChange={setRawText} onSubmit={runAi} />
        <div className="flex items-center gap-3 text-caption text-fg-muted">
          <span className="h-px flex-1 bg-border" />
          {t("ai.divider")}
          <span className="h-px flex-1 bg-border" />
        </div>
      </>
    ) : null}
    {form(saving ? t("ai.processing") : isEditing ? t("saveChanges") : t("submit"))}
  </div>
)
```

8. In the `mode === "failed"` branch, the `onCancel` handler that called `setAttachment(null)` — drop that call, keep `setRawText("")` and `backToManual()`. Same in `afterSuccess` (`setAttachment(null)` → delete the line).

- [ ] **Step 5: Pass the prop from the route**

In `src/app/(app)/add/page.tsx`:
```tsx
import { Suspense } from "react";

import { isAiConfigured } from "@/ai/providers";
import { titleMetadata } from "@/lib/page-metadata";
import { AddKnowledgeView } from "@/features/add";

export const generateMetadata = titleMetadata((t) => t("nav.add"));

export default function AddKnowledgePage() {
  return (
    <Suspense>
      <AddKnowledgeView aiEnabled={isAiConfigured()} />
    </Suspense>
  );
}
```

- [ ] **Step 6: Trim the Today capture bar**

In `src/features/today/components/capture-bar.tsx`, delete the two shortcut `<Link>` blocks — the one with `query: { attach: "photo" }` (Camera) and the one with `query: { attach: "file" }` (FileText) — and drop `Camera` / `FileText` from the `lucide-react` import. Keep the prompt link and the submit link. Update the block comment's "the photo/file shortcuts and" clause to just describe the prompt + submit.

- [ ] **Step 7: Drop the "simulated" copy**

In `src/messages/en.json`, `add.ai.disclaimer`:
`"AI proposes a structure — you review and confirm before anything is saved. Simulated for now."`
→ `"AI proposes a structure — you review and confirm before anything is saved."`

In `src/messages/nl.json`, `add.ai.disclaimer`:
`"AI stelt een structuur voor — jij controleert en bevestigt voordat er iets wordt opgeslagen. Nu nog gesimuleerd."`
→ `"AI stelt een structuur voor — jij controleert en bevestigt voordat er iets wordt opgeslagen."`

- [ ] **Step 8: Delete the mock**

```bash
git rm src/data/mock/index.ts
```
Then remove the now-empty `src/data/` directory if git leaves it (`rmdir src/data/mock src/data` or delete via the editor).

- [ ] **Step 9: Run the component test**

Run:
```bash
npx vitest run src/features/add/add-knowledge-view.test.tsx
```
Expected: PASS (2 tests). Add `vi.mock`s for any un-mocked imports the render surfaces.

- [ ] **Step 10: Full gates + orphan grep**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: all green (baseline 148 + all new tests; no test file references `@/data/mock`).

Then confirm nothing dangling:
```bash
grep -rn "data/mock\|getAiSuggestion\|getAiSuggestionFromAttachment\|attach=\|AiAttachment" src/ --include=*.ts --include=*.tsx
```
Expected: only hits are `classifyAttachment` / `AiAttachment` *definitions* in `src/features/add/types.ts` (kept intentionally) — no imports, no `@/data/mock`, no `?attach=` links.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(ai): wire Add screen to structureKnowledgeAction; drop the mock

- AddKnowledgeView takes aiEnabled; capture box hidden when AI_API_KEY unset
- AiCaptureBox is text-only; photo/file capture deferred to a later slice
- remove the Today capture-bar photo/file shortcuts and the ?attach= flow
- delete src/data/mock (getAiSuggestion was its only consumer)
- drop 'simulated' from add.ai.disclaimer (en + nl)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Task 8: Final verification & spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-backend-phase-4-ai-knowledge-processor-design.md` (status line only)

- [ ] **Step 1: Keyless run**

Confirm the suite passes with no key in the environment (the default in CI):
```bash
AI_API_KEY= AI_MODEL= npm test
```
Expected: all pass; no test performs a network call.

- [ ] **Step 2: Full gates once more**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: typecheck clean, lint clean, all green. Record the pass/skip counts.

- [ ] **Step 3: Manual smoke checklist for the owner** (document in the PR body, not executed here)

With a real `AI_API_KEY` set locally (`.env.local`) and `npm run dev`:
1. `/add` shows the "Structure with AI" box. Paste `gezellig — cozy` → Structure → lands as **vocabulary**, `term`/`meaning` filled, level blank.
2. Paste a 2-sentence grammar explanation → **grammar**, with a summary/examples notice.
3. Paste a paragraph of Dutch → **reading**, body verbatim.
4. Paste one word → **vocabulary** (or **note**), fields sensible.
5. Confirm one suggestion → item saves, `source` = `ai-assisted`, appears in Library.
6. Unset `AI_API_KEY`, restart → `/add` shows only the manual form; Today's capture bar has no camera/file icons.
7. NL/EN toggle on `/add` — the disclaimer no longer says "simulated".

- [ ] **Step 4: Flip the spec status**

In the spec, change:
`**Status:** Approved design — pending implementation plan`
→ `**Status:** Implemented — branch feature/backend-phase-4-ai-knowledge-processor (manual smoke pending owner)`

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-07-backend-phase-4-ai-knowledge-processor-design.md
git commit -m "docs(ai): mark Phase 4 spec implemented

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017GTbaZbN9YY7VbAb7BYhe9"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
| --- | --- |
| §2 slice size / text-only | Tasks 5, 7 (attachment code removed) |
| §2 provider isolation | Task 3 (`types.ts` interface; SDK only in `anthropic.ts`); Global Constraints |
| §2 SDK / `messages.parse` + structured outputs | Task 3 Step 4 |
| §2 model default `claude-sonnet-5` | Task 1 (`aiModel` getter) |
| §2 missing key ⇒ graceful | Task 3 (`getAiProvider` → null), Task 6 (`ai-unavailable`), Task 7 (`aiEnabled` gate), Task 8 Step 1 |
| §2 `noticeKey` closed enum | Task 2 (`NOTICE_KEYS`, `z.enum`) |
| §2 guardrail = length cap only | Task 6 (`rawKnowledgeTextSchema`) |
| §2 authorization (active group) | Task 6 (`resolveActiveContext()`) |
| §3 `src/ai/` module table | Tasks 2–5 |
| §3 server modules (`actions/ai.ts`, schema, env) | Tasks 1, 6 |
| §3 client callers (`add/page.tsx`, view, capture-box) | Task 7 |
| §4 schema shape + `toAiSuggestion` mapping table | Task 2 (schema + mapper + tests per type) |
| §5 provider adapter behaviour (refusal, null, error mapping) | Task 3 Steps 2, 4 |
| §6 `StructureResult` + `structureKnowledge` flow | Task 5 |
| §7 versioned prompt + `PROMPT_VERSION` | Task 4 |
| §8 action shape + failure codes | Task 6 |
| §9 client changes incl. attach-button removal, `source`, i18n | Task 7 Steps 3–8 |
| §9 Today capture-bar shortcuts (extension of "hide the attach buttons") | Task 7 Step 6 |
| §10 env + dependency + `.env.example` | Task 1 |
| §11 test matrix (5 files) | env → T1, schema → T2, adapter → T3, service → T5, action → T6, component → T7 |
| §12 out of scope | nothing in any task touches Explainer / practice-gen / embeddings / rate-limiting / streaming |
| §13 rollout / smoke checklist | Task 8 |

No uncovered spec requirement.

**2. Placeholder scan** — every code and test step carries complete, runnable content. The only deferred judgement calls are explicitly bounded: "adjust the SDK call here if the installed version differs" (Task 3, confined to `anthropic.ts`) and "add `vi.mock`s for un-mocked imports the render surfaces" (Task 7, a known consequence of the repo having no prior `src/features` component test). Neither is a "TODO / handle edge cases" placeholder.

**3. Type consistency** — `AiProvider.generateStructured({ system, user, schema })` is defined in Task 3 `types.ts` and consumed with those exact keys in Task 3 `anthropic.ts` and Task 5 service. `StructureResult` variants (`ok` / `unavailable` / `error`) are produced in Task 5 and matched in Task 6's `switch`. `structureKnowledgeAction` failure codes (`validation` / `ai-unavailable` / `ai-error`) match between Task 6's implementation and its test. `toAiSuggestion` returns the exact `AiSuggestion` field keys (`term`, `meaning`, `partOfSpeech`, `title`, `summary`, `explanation`, `readingBody`, `noteBody`) that `add-knowledge-view.tsx`'s `runAi` feeds into `setValues`. `isAiConfigured` is exported from `@/ai/providers` (Task 3 `index.ts`) and imported in `add/page.tsx` (Task 7). `NOTICE_KEYS` values are identical in the schema (Task 2) and the prompt text (Task 4).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-07-backend-phase-4-ai-knowledge-processor.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration. Matches how Phases 1–3 were executed.

**2. Inline Execution** — tasks run in this session via `superpowers:executing-plans`, batched with checkpoints for review.

**Which approach?**
