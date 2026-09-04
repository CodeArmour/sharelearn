import { NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/server/auth/supabase";

/**
 * PKCE magic-link callback. Supabase redirects here with `?code=…` (and an
 * optional `?token=…` invite code). We exchange the code for a session — which
 * writes the auth cookies via the route-handler client — then bounce the user
 * to the invite-accept screen when an invite token is present, otherwise home.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token = url.searchParams.get("token");

  if (code) {
    const supabase = await createRouteHandlerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const dest = token ? `/invite/${encodeURIComponent(token)}` : "/";
  return NextResponse.redirect(new URL(dest, url.origin));
}
