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

  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") {
    return { ok: false, code: "unauthorized", message: "Sign in to use AI structuring" };
  }

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
