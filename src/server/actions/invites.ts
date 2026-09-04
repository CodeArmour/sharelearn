"use server";

import { revalidatePath } from "next/cache";

import { inviteMember, revokeInvitation } from "@/server/services/invite-service";

import {
  emailSchema,
  invitationIdSchema,
  toActionError,
  type ActionResult,
} from "./schemas";

export async function inviteMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: "Enter a valid email address",
    };
  }
  try {
    const res = await inviteMember({ email: parsed.data });
    revalidatePath("/settings/group");
    return { ok: true, data: { email: res.email } };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function revokeInvitationAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = invitationIdSchema.safeParse(formData.get("invitationId"));
  if (!parsed.success)
    return { ok: false, code: "validation", message: "Invalid invite" };
  try {
    await revokeInvitation({ invitationId: parsed.data });
    revalidatePath("/settings/group");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}
