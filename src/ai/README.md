# `src/ai/` — AI functionality

Provider-isolated so the model vendor stays swappable. Currently backs the
**AI capture** step on the Add-knowledge screen (Backend Phase 4).

## Layout

| Directory        | Responsibility                                                                     |
| ---------------- | --------------------------------------------------------------------------------- |
| `ai/providers/`  | Provider adapters (OpenAI) behind the `AiProvider` interface; `config.ts` holds the SDK-free `isAiConfigured()`. |
| `ai/schemas/`    | Zod schemas for every structured AI output.                                        |
| `ai/prompts/`    | Prompt templates, versioned (`PROMPT_VERSION`).                                     |
| `ai/services/`   | Task services. Implemented: `knowledge-processor`. Planned: `Explainer`, `PracticeGenerator`, `AnswerEvaluator`, `ExamGenerator`. |

## Flow

```
Server Action  →  ai/services  →  ai/providers  (one structured model call)
             raw model output  →  ai/schemas (Zod validation)  →  typed result  →  app
```

The knowledge processor also makes a focused follow-up call when a grammar
result comes back without examples.

## Rules

- Only `src/server/` and `src/ai/services/` call into `ai/providers/`.
- Every provider response is validated against an `ai/schemas/` schema before it
  reaches application code.
- **No provider SDK import outside `ai/providers/`.** A Server Component that
  only needs the on/off check imports `isAiConfigured` from
  `ai/providers/config` (SDK-free), never the barrel.

## Configuration

`AI_API_KEY` is optional — when unset, `getAiProvider()` returns `null`, the
action returns `ai-unavailable`, and the Add screen shows the manual form only.
`AI_MODEL` (default `gpt-5.6-luna`) and `OPENAI_FALLBACK_MODEL` (default
`gpt-5.6-terra`, retried once on a failed primary call) override the models.
