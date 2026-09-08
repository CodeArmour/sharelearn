import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client — the project's first. Shares the `@supabase/ssr`
 * cookie session with the server helper (`src/server/auth/supabase.ts`), so
 * Storage RLS applies as the signed-in user. Used only for uploading downscaled
 * photos to `CAPTURE_BUCKET` from the Add-knowledge screen.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
