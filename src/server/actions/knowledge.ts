"use server";

import { revalidatePath } from "next/cache";

import { createKnowledgeItem, getKnowledgeByIds } from "@/server/services/knowledge-service";
import type { KnowledgeItem } from "@/types";

import {
  createKnowledgeItemSchema,
  knowledgeIdsSchema,
  toActionError,
  type ActionResult,
} from "./schemas";

export async function createKnowledgeItemAction(
  input: unknown,
): Promise<ActionResult<KnowledgeItem>> {
  const parsed = createKnowledgeItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: "Invalid knowledge item" };
  }
  try {
    const item = await createKnowledgeItem(parsed.data);
    revalidatePath("/today");
    revalidatePath("/library");
    return { ok: true, data: item };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function resolveKnowledgeByIdsAction(
  ids: unknown,
): Promise<ActionResult<KnowledgeItem[]>> {
  const parsed = knowledgeIdsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, code: "validation", message: "Invalid ids" };
  try {
    return { ok: true, data: await getKnowledgeByIds(parsed.data) };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}
