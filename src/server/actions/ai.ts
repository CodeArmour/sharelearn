"use server";

import { extractKnowledgeFromImages } from "@/ai/services/knowledge-extractor";
import { structureKnowledge } from "@/ai/services/knowledge-processor";
import { CAPTURE_BUCKET } from "@/lib/supabase/constants";
import { createServerSupabaseClient } from "@/server/auth/supabase";
import {
  duplicateKeyFromSuggestion,
  findDuplicateKeys,
} from "@/server/services/knowledge-service";
import { resolveActiveContext } from "@/server/services/session-service";
import type { AiSuggestion } from "@/types";

import { type ActionResult, capturePathsSchema, rawKnowledgeTextSchema } from "./schemas";

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

/**
 * Read 1–3 already-uploaded staging photos into a reviewable set of
 * `AiSuggestion`s. Nothing is persisted — the reviewer confirms the set on the
 * checklist, which then calls `createKnowledgeItemsAction`. The staged objects
 * are deleted on every exit path; the daily sweep is the backstop.
 */
export async function extractFromPhotosAction(
  paths: unknown,
): Promise<ActionResult<{ items: AiSuggestion[]; truncated: boolean; duplicates: number[] }>> {
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
        const { data, error } = await bucket.createSignedUrl(path, 300);
        if (error || !data) throw new Error(error?.message ?? "could not sign upload");
        return { url: data.signedUrl };
      }),
    );

    const result = await extractKnowledgeFromImages(signed);
    switch (result.status) {
      case "ok": {
        const dupMap = await findDuplicateKeys(
          result.items.map(duplicateKeyFromSuggestion),
          ctx.activeGroup.id,
        );
        return {
          ok: true,
          data: {
            items: result.items,
            truncated: result.truncated,
            duplicates: [...dupMap.keys()],
          },
        };
      }
      case "unavailable":
        return { ok: false, code: "ai-unavailable", message: "AI capture is not available" };
      case "error":
        return { ok: false, code: "ai-error", message: "Could not read those photos — add items manually" };
    }
  } catch (error) {
    console.error("[action:extractFromPhotos] failed", error);
    return { ok: false, code: "ai-error", message: "Could not read those photos — add items manually" };
  } finally {
    await bucket.remove(parsed.data).catch(() => {});
  }
}
