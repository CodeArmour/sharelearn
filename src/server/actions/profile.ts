"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { completeOnboarding, updateProfileDetails } from "@/server/services/profile-service";
import type { ProfileFields } from "@/types";

import { profileFieldsSchema, toActionError, type ActionResult } from "./schemas";

function profileFieldsFromFormData(formData: FormData): unknown {
  const cefrLevel = formData.get("cefrLevel");
  const learningGoal = formData.get("learningGoal");
  return {
    fullName: formData.get("fullName"),
    nickname: formData.get("nickname"),
    avatar: {
      character: formData.get("character"),
      skinColor: formData.get("skinColor"),
      hairColor: formData.get("hairColor"),
      shirtColor: formData.get("shirtColor"),
      backgroundColor: formData.get("backgroundColor"),
    },
    cefrLevel: cefrLevel ? cefrLevel : null,
    learningGoal: learningGoal ? learningGoal : null,
  };
}

export async function completeOnboardingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = profileFieldsSchema.safeParse(profileFieldsFromFormData(formData));
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "Check the form",
    };
  }
  try {
    await completeOnboarding(parsed.data as ProfileFields);
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
  redirect("/today");
}

export async function updateProfileAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = profileFieldsSchema.safeParse(profileFieldsFromFormData(formData));
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: parsed.error.issues[0]?.message ?? "Check the form",
    };
  }
  try {
    await updateProfileDetails(parsed.data as ProfileFields);
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
  revalidatePath("/profile");
  return { ok: true, data: undefined };
}
