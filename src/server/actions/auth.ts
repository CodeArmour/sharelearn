"use server";

import { redirect } from "next/navigation";

import { clearActiveGroupId } from "@/server/active-group";
import { createServerSupabaseClient } from "@/server/auth/supabase";
import { serverEnv } from "@/server/env";

import { emailSchema, toActionError, type ActionResult } from "./schemas";

export async function sendMagicLink(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: "Enter a valid email address",
    };
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: {
        emailRedirectTo: `${serverEnv.siteUrl}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) return { ok: false, code: "supabase", message: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  await clearActiveGroupId();
  redirect("/login");
}
