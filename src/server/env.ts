import "server-only";

/**
 * The deployed app's public origin. Auth redirect links (magic link, invite)
 * are built from this, so on the Vercel **production** deployment it must be the
 * real domain — a stale `SITE_URL` pointing at localhost would otherwise send
 * every production sign-in link back to localhost.
 */
const PRODUCTION_SITE_URL = "https://dutch.omarcode.dev";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get dbPoolUrl() {
    return required("SUPABASE_DB_POOL_URL");
  },
  get siteUrl() {
    if (process.env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
    return trimTrailingSlash(process.env.SITE_URL ?? "http://localhost:3000");
  },
  get aiApiKey() {
    return optional("AI_API_KEY");
  },
  get aiModel() {
    return optional("AI_MODEL") ?? "claude-sonnet-5";
  },
};
