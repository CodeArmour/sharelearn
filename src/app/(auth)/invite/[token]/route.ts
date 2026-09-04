import { NextResponse } from "next/server";

import { getSession } from "@/server/auth/session";
import { InviteError } from "@/server/errors";
import { acceptInvitation } from "@/server/services/invite-service";

/**
 * PKCE-adjacent invite acceptance. Runs as a Route Handler (not a page) so
 * `acceptInvitation`'s active-group cookie write actually persists — Next 16
 * forbids cookie writes during a Server Component render, which a `page.tsx`
 * here would have been. Error outcomes redirect to the sibling `/outcome`
 * page, which just renders `<InviteOutcome>`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const url = new URL(request.url);

  if (!(await getSession())) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  try {
    await acceptInvitation({ token });
  } catch (e) {
    if (e instanceof InviteError) {
      const dest = new URL(`/invite/${encodeURIComponent(token)}/outcome`, url.origin);
      dest.searchParams.set("code", e.inviteCode);
      return NextResponse.redirect(dest);
    }
    throw e;
  }

  return NextResponse.redirect(new URL("/today", url.origin));
}
