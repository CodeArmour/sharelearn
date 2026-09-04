import "server-only";

import type { Session } from "@supabase/supabase-js";

import { getProfile } from "@/server/repositories/profiles";
import type { UserSummary } from "@/types";

import { deriveAccent, deriveInitials } from "./identity";
import { createServerSupabaseClient } from "./supabase";

export async function getSession(): Promise<Session | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** The signed-in user as a frontend `UserSummary`, or null if not signed in. */
export async function getCurrentUser(): Promise<UserSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  if (!authUser) return null;

  const profile = await getProfile(authUser.id);
  if (profile) {
    return {
      id: authUser.id,
      name: profile.displayName,
      initials: profile.initials,
      accent: profile.accent as UserSummary["accent"],
      avatarUrl: null,
    };
  }
  // Authed but no profile row yet (pre-accept edge case) — derive, don't persist.
  const email = authUser.email ?? "user@unknown";
  return {
    id: authUser.id,
    name: email.split("@")[0],
    initials: deriveInitials(email),
    accent: deriveAccent(authUser.id),
    avatarUrl: null,
  };
}
