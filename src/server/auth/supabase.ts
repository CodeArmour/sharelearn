import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { serverEnv } from "@/server/env";

/** RSC / Server Action client. Reads the session cookie; cookie writes are
 * best-effort (a no-op in pure RSC render, which is fine). */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // called from a Server Component render — ignore; middleware refreshes.
        }
      },
    },
  });
}

/** Route-handler client — identical wiring; the handler returns a response whose
 * cookies were mutated via `cookies()`. */
export const createRouteHandlerSupabaseClient = createServerSupabaseClient;

/** Service-role client. No session, never sent to the browser. */
export function createAdminSupabaseClient(): SupabaseClient {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
