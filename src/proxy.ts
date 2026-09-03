import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** App-shell route prefixes that require an authenticated user. `/groups` is
 * deliberately absent: the group picker must stay reachable for a signed-in
 * user who has no active group yet. */
const APP_PREFIXES = [
  "/today",
  "/library",
  "/practice",
  "/exam",
  "/add",
  "/profile",
  "/settings",
  "/knowledge",
  "/foundation",
];

/**
 * Edge proxy (the file convention formerly known as `middleware`). Refreshes the
 * Supabase session cookie on every matched request and applies a coarse,
 * DB-free auth gate:
 *   - an app-shell path with no user  → redirect to `/login`
 *   - `/login` while signed in        → redirect to `/`
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // @supabase/ssr 0.12.x also hands back no-store cache headers that
          // must ride along with the refreshed Set-Cookie.
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              response.headers.set(key, value);
            }
          }
        },
      },
    },
  );

  // Touch the session so @supabase/ssr writes any refreshed cookies via setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const inApp = APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (inApp && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, the favicon, the PKCE callback route
    // (which must finish the code exchange without proxy interference), and
    // static asset extensions.
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
