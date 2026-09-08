# `src/ai/` — AI functionality (reserved)

Not implemented in the frontend-foundation phase. Isolated from the rest of the
app so provider choice stays swappable.

## Planned layout

| Directory        | Responsibility                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `ai/providers/`  | Provider adapters (OpenAI, …) behind one internal interface.        |
| `ai/schemas/`    | Zod schemas for every structured AI output.                           |
| `ai/prompts/`    | Prompt templates, versioned.                                          |
| `ai/services/`   | Task services: `KnowledgeProcessor`, `Explainer`, `PracticeGenerator`, `AnswerEvaluator`, `ExamGenerator`. |

## Intended flow

```
UI → server action / route handler → ai/services → ai/providers
   → raw model output → ai/schemas (Zod validation) → typed result → app
```

## Rules

- Only `src/server/` and `src/ai/services/` call into `ai/providers/`.
- Every provider response is validated against an `ai/schemas/` schema before
  it reaches application code.
- No provider SDK import outside `ai/providers/`.
