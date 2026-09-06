import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/server/auth/supabase";

/**
 * Auth landing route. Two shapes reach it:
 *
 * - **PKCE** (`?code=…`) — magic-link sign-in via `signInWithOtp`. Exchanged for
 *   a session with `exchangeCodeForSession`.
 * - **Token hash** (`?token_hash=…&type=…`) — invitations. `invite.html` links
 *   here instead of Supabase's default hosted redirect, so the session is
 *   established server-side with `verifyOtp`. Without this the invite comes back
 *   as an implicit-flow `#access_token` fragment, which a server route can't
 *   read — so no session cookie is ever set and `/invite/<token>` runs against
 *   a stale/absent session.
 *
 * Either way `?token=` carries our app invitation token; when present we bounce
 * to `/invite/<token>` to finish acceptance, otherwise home.
 */
const OTP_TYPES: readonly EmailOtpType[] = ["invite", "magiclink", "recovery", "email", "signup"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const token = url.searchParams.get("token");

  if (code) {
    const supabase = await createRouteHandlerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && isOtpType(type)) {
    const supabase = await createRouteHandlerSupabaseClient();
    await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  }

  const dest = token ? `/invite/${encodeURIComponent(token)}` : "/";
  return NextResponse.redirect(new URL(dest, url.origin));
}
