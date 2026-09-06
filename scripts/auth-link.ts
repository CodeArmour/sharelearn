import { createClient } from "@supabase/supabase-js";

/**
 * Mint a Supabase auth link (magic link / invite / recovery) via the Admin API
 * and print it — no email is sent. Use this for local dev and manual
 * verification so you never hit Supabase's built-in email rate limit (~2/hour).
 * See docs/supabase-auth-email.md.
 *
 *   npm run auth:link -- you@example.com
 *   npm run auth:link -- you@example.com --type invite
 *   npm run auth:link -- you@example.com --redirect-to "http://localhost:3000/auth/callback?token=abc"
 *
 * Mirrors src/server/db/seed.ts: inline admin client, reads process.env
 * directly (no @/server/env, whose eager "server-only" / required() throws
 * don't play nice with a plain tsx script).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = ["magiclink", "invite", "recovery"] as const;
type LinkType = (typeof TYPES)[number];

const USAGE = `Usage: npm run auth:link -- <email> [--type ${TYPES.join("|")}] [--redirect-to <url>]

  <email>              address to mint the link for
  --type <type>        link type (default: magiclink)
                       magiclink / recovery need an existing user; invite creates one
  --redirect-to <url>  where the link lands after verification
                       (default: $SITE_URL/auth/callback)
  --help               show this message`;

function parseArgs(argv: string[]): {
  email: string;
  type: LinkType;
  redirectTo?: string;
} {
  let email: string | undefined;
  let type: LinkType = "magiclink";
  let redirectTo: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === "--type" || arg.startsWith("--type=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
      if (!(TYPES as readonly string[]).includes(value)) {
        throw new Error(`Invalid --type "${value}". Expected one of: ${TYPES.join(", ")}`);
      }
      type = value as LinkType;
    } else if (arg === "--redirect-to" || arg.startsWith("--redirect-to=")) {
      redirectTo = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[++i];
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option "${arg}"\n\n${USAGE}`);
    } else if (email === undefined) {
      email = arg;
    } else {
      throw new Error(`Unexpected argument "${arg}"\n\n${USAGE}`);
    }
  }

  if (!email) throw new Error(`Missing <email>\n\n${USAGE}`);
  if (!EMAIL_RE.test(email)) throw new Error(`"${email}" is not a valid email address`);

  return { email, type, redirectTo };
}

async function main() {
  const { email, type, redirectTo } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const finalRedirectTo = redirectTo ?? `${siteUrl}/auth/callback`;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: finalRedirectTo },
  });

  if (error) {
    const notFound = /user.*not.*found|not.*registered|no.*user/i.test(error.message);
    if (type === "magiclink" && notFound) {
      throw new Error(
        `${error.message}\n\nmagiclink needs an existing user. Re-run with --type invite ` +
          `to create ${email} and get a link.`,
      );
    }
    throw error;
  }

  const { action_link, email_otp } = data.properties;
  console.log(`email:        ${email}`);
  console.log(`type:         ${type}`);
  console.log(`redirect_to:  ${finalRedirectTo}`);
  if (email_otp) console.log(`otp:          ${email_otp}`);
  console.log(`\n${action_link}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
