"use server";

import { redirect } from "next/navigation";

import { clearActiveGroupId } from "@/server/active-group";
import { createServerSupabaseClient } from "@/server/auth/supabase";
import { serverEnv } from "@/server/env";

import { emailSchema, otpCodeSchema, toActionError, type ActionResult } from "./schemas";

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

/**
 * Verify the 6-digit code from the magic-link email (the `{{ .Token }}` in
 * `magic-link.html`) — the alternative to clicking the link. On success the SSR
 * client writes the session cookie and we redirect into the app; on failure the
 * caller renders an inline error.
 *
 * `type: "email"` covers an existing user signing back in. New accounts are
 * created through the invite flow (`/invite/[token]`), not this page.
 */
export async function verifyMagicLinkCode(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const email = emailSchema.safeParse(formData.get("email"));
  const code = otpCodeSchema.safeParse(formData.get("code"));
  if (!email.success || !code.success) {
    return {
      ok: false,
      code: "validation",
      message: "Enter the 6-digit code from the email",
    };
  }

  let message: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.data,
      token: code.data,
      type: "email",
    });
    message = error?.message ?? null;
  } catch (e) {
    return { ok: false, ...toActionError(e) };
  }

  if (message) return { ok: false, code: "supabase", message };
  redirect("/"); // success — throws NEXT_REDIRECT, never returns
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  await clearActiveGroupId();
  redirect("/login");
}
