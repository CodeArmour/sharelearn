"use server";

import { redirect } from "next/navigation";

import { switchActiveGroup } from "@/server/services/group-service";

import { groupIdSchema, toActionError, type ActionResult } from "./schemas";

export async function switchActiveGroupAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = groupIdSchema.safeParse(formData.get("groupId"));
  if (!parsed.success)
    return { ok: false, code: "validation", message: "Invalid group" };
  try {
    await switchActiveGroup(parsed.data);
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
  redirect("/today");
}
