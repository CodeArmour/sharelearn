"use server";

import {
  extractKnowledgeFromFiles,
  extractKnowledgeFromSpreadsheetRows,
} from "@/ai/services/knowledge-extractor";
import { structureKnowledge } from "@/ai/services/knowledge-processor";
import { readSpreadsheetBatch } from "@/ai/services/spreadsheet-import";
import { CAPTURE_BUCKET } from "@/lib/supabase/constants";
import { createServerSupabaseClient } from "@/server/auth/supabase";
import { duplicateKeyFromSuggestion, findDuplicateKeys } from "@/server/services/knowledge-service";
import { resolveActiveContext } from "@/server/services/session-service";
import type { AiSuggestion } from "@/types";

import {
  type ActionResult,
  captureFilePathsSchema,
  rawKnowledgeTextSchema,
  spreadsheetBatchSchema,
  spreadsheetCapturePathSchema,
} from "./schemas";

const DOCUMENT_CONTENT_TYPES = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

type SpreadsheetBatchData = {
  items: AiSuggestion[];
  duplicates: number[];
  totalRows: number;
  processedRows: number;
  nextCursor: number | null;
};

async function duplicateIndexes(items: AiSuggestion[], groupId: string): Promise<number[]> {
  const duplicateMap = await findDuplicateKeys(
    items.map(duplicateKeyFromSuggestion),
    groupId,
  );
  return [...duplicateMap.keys()];
}

/**
 * Structure pasted study text into a reviewable suggestion. Nothing is
 * persisted until the reviewer confirms it in the Add form. An active group
 * context is required before the model is called.
 */
export async function structureKnowledgeAction(
  rawText: unknown,
): Promise<ActionResult<AiSuggestion>> {
  const parsed = rawKnowledgeTextSchema.safeParse(rawText);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
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
      return { ok: false, code: "ai-error", message: "Could not structure that. Add it manually." };
  }
}

/**
 * Read one to three already-uploaded staging files into a reviewable set of
 * suggestions. The reviewer must confirm them before they persist. Staged
 * objects are deleted on every exit path; the daily sweep is the backstop.
 */
export async function extractFromFilesAction(
  paths: unknown,
): Promise<ActionResult<{ items: AiSuggestion[]; truncated: boolean; duplicates: number[] }>> {
  const parsed = captureFilePathsSchema.safeParse(paths);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: "Invalid file upload" };
  }

  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") {
    return { ok: false, code: "unauthorized", message: "Sign in to use AI capture" };
  }

  if (parsed.data.some((path) => !path.startsWith(ctx.user.id + "/"))) {
    return { ok: false, code: "validation", message: "Invalid file upload" };
  }

  const supabase = await createServerSupabaseClient();
  const bucket = supabase.storage.from(CAPTURE_BUCKET);

  try {
    const attachments = await Promise.all(
      parsed.data.map(async (path) => {
        const filename = path.slice(path.lastIndexOf("/") + 1);
        if (path.endsWith(".jpg")) {
          const { data, error } = await bucket.createSignedUrl(path, 300);
          if (error || !data) throw new Error(error?.message ?? "could not sign upload");
          return { kind: "image", url: data.signedUrl } as const;
        }

        const extension = filename.slice(
          filename.lastIndexOf(".") + 1,
        ) as keyof typeof DOCUMENT_CONTENT_TYPES;
        const contentType = DOCUMENT_CONTENT_TYPES[extension];
        if (!contentType) throw new Error("unsupported capture file");

        const downloaded = await bucket.download(path);
        if (downloaded.error || !downloaded.data) {
          throw new Error(downloaded.error?.message ?? "could not read upload");
        }

        const base64 = Buffer.from(await downloaded.data.arrayBuffer()).toString("base64");
        return {
          kind: "file",
          fileData: `data:${contentType};base64,${base64}`,
          filename,
        } as const;
      }),
    );

    const result = await extractKnowledgeFromFiles(attachments);
    switch (result.status) {
      case "ok": {
        return {
          ok: true,
          data: {
            items: result.items,
            truncated: result.truncated,
            duplicates: await duplicateIndexes(result.items, ctx.activeGroup.id),
          },
        };
      }
      case "unavailable":
        return { ok: false, code: "ai-unavailable", message: "AI capture is not available" };
      case "error":
        return {
          ok: false,
          code: "ai-error",
          message: "Could not read those files. Add items manually.",
        };
    }
  } catch (error) {
    console.error("[action:extractFromFiles] failed", error);
    return {
      ok: false,
      code: "ai-error",
      message: "Could not read those files. Add items manually.",
    };
  } finally {
    await bucket.remove(parsed.data).catch(() => {});
  }
}

export async function extractSpreadsheetBatchAction(
  input: unknown,
): Promise<ActionResult<SpreadsheetBatchData>> {
  const parsed = spreadsheetBatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: "Invalid spreadsheet upload" };
  }

  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") {
    return { ok: false, code: "unauthorized", message: "Sign in to use AI capture" };
  }
  if (!parsed.data.path.startsWith(ctx.user.id + "/")) {
    return { ok: false, code: "validation", message: "Invalid spreadsheet upload" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const bucket = supabase.storage.from(CAPTURE_BUCKET);
    const downloaded = await bucket.download(parsed.data.path);
    if (downloaded.error || !downloaded.data) {
      throw new Error(downloaded.error?.message ?? "could not read upload");
    }

    const batch = readSpreadsheetBatch(await downloaded.data.arrayBuffer(), parsed.data.cursor);
    const result = await extractKnowledgeFromSpreadsheetRows(batch.rows);
    switch (result.status) {
      case "ok":
        return {
          ok: true,
          data: {
            items: result.items,
            duplicates: await duplicateIndexes(result.items, ctx.activeGroup.id),
            totalRows: batch.totalRows,
            processedRows: batch.processedRows,
            nextCursor: batch.nextCursor,
          },
        };
      case "empty":
        return {
          ok: true,
          data: {
            items: [],
            duplicates: [],
            totalRows: batch.totalRows,
            processedRows: batch.processedRows,
            nextCursor: batch.nextCursor,
          },
        };
      case "unavailable":
        return { ok: false, code: "ai-unavailable", message: "AI capture is not available" };
      case "error":
        return {
          ok: false,
          code: "ai-error",
          message: "Could not read this spreadsheet batch. Try again or add items manually.",
        };
    }
  } catch (error) {
    console.error("[action:extractSpreadsheetBatch] failed", error);
    return {
      ok: false,
      code: "ai-error",
      message: "Could not read this spreadsheet batch. Try again or add items manually.",
    };
  }
}

export async function discardSpreadsheetImportAction(path: unknown): Promise<ActionResult> {
  const parsed = spreadsheetCapturePathSchema.safeParse(path);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: "Invalid spreadsheet upload" };
  }

  const ctx = await resolveActiveContext();
  if (ctx.status !== "ok") {
    return { ok: false, code: "unauthorized", message: "Sign in to manage AI uploads" };
  }
  if (!parsed.data.startsWith(ctx.user.id + "/")) {
    return { ok: false, code: "validation", message: "Invalid spreadsheet upload" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.storage.from(CAPTURE_BUCKET).remove([parsed.data]);
    if (error) throw new Error(error.message);
    return { ok: true, data: undefined };
  } catch (error) {
    console.error("[action:discardSpreadsheetImport] failed", error);
    return { ok: false, code: "storage-error", message: "Could not remove spreadsheet upload" };
  }
}
