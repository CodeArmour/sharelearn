# Supabase Auth email: custom SMTP + the rate limit

## Why this exists

Supabase's **built-in** auth email sender is for testing only. It is hard-capped
at **~2 emails per hour** with no delivery guarantee. Every backend phase that
needed a magic link for two test accounts has hit that cap immediately and
stalled manual verification.

There are two independent fixes. Do the one that matches what you need:

| You want | Use |
| --- | --- |
| Real emails delivered (staging, a demo, more than one tester) | **Custom SMTP** — one-time setup, below |
| A login link right now, on your machine, no email at all | **`npm run auth:link`** or **Auth Logs** — below |

This project runs its hosted Supabase project through the **dashboard + Drizzle
migrations** — there is no `supabase/` directory, no Supabase CLI, no local
stack. Everything here is dashboard configuration.

---

## Fix A — Custom SMTP (recommended: Resend)

Resend has a free tier (**3,000 emails/month, 100/day, one domain**) and a short
domain-verification flow. Any SMTP provider works (SES, Postmark, Mailgun…); the
Supabase side is identical.

### 1. Create a Resend account and verify a sending domain

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain**. Enter the domain you will send from
   (e.g. `mail.example.com` or the apex domain).
3. Resend shows a set of DNS records — an **MX** record, an **SPF** `TXT`
   record, and a **DKIM** `TXT` record. Add them at your DNS host.
4. Click **Verify**. Propagation is usually minutes, sometimes longer.

> Quick test without a domain: Resend lets you send from `onboarding@resend.dev`,
> but only to the email address that owns the Resend account. Fine for a single
> self-test, not for inviting other testers.

### 2. Create an API key

**API Keys → Create API Key**. Sending permission is enough. Copy it now — it is
shown once. This key is your SMTP password.

### 3. Point Supabase Auth at Resend

Dashboard → **Authentication → SMTP Settings**
(`https://supabase.com/dashboard/project/_/auth/smtp`). Enable **custom SMTP** and
fill in:

| Field | Value |
| --- | --- |
| Sender email | an address **at your verified domain**, e.g. `no-reply@mail.example.com` |
| Sender name | `Dutch Study Group` (or whatever the app should say) |
| Host | `smtp.resend.com` |
| Port | `465` (implicit TLS). STARTTLS alternatives: `587`, `2587`, `25` |
| Username | `resend` |
| Password | the Resend API key from step 2 |

Save. Send yourself a magic link from `/login` to confirm delivery.

### 4. Raise the auth rate limits

Enabling custom SMTP only lifts the cap to a **default 30 emails/hour** — still
low for a verification run that creates several accounts and re-requests links.

Dashboard → **Authentication → Rate Limits**
(`https://supabase.com/dashboard/project/_/auth/rate-limits`). Raise:

- **Rate limit for sending emails** — bump to e.g. `100`/hour for active testing.
- **Rate limit for verifying an OTP / token** — raise if you are entering codes
  repeatedly.

Lower them again before anything resembling production traffic.

---

## Fix B — get a link with no email at all

### `npm run auth:link` (preferred for local dev)

Mints an auth link through the Supabase Admin API and prints it. **No email is
sent**, so the rate limit is irrelevant. Needs `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (already there for `db:seed`).

```bash
# existing user → magic link
npm run auth:link -- you@example.com

# new user → invite link (creates the user, then logs them in)
npm run auth:link -- newtester@example.com --type invite

# land on the invite-accept screen: point the callback at an app invite token
npm run auth:link -- you@example.com \
  --redirect-to "http://localhost:3000/auth/callback?token=<invitation-token>"
```

Flags:

| Flag | Default | Notes |
| --- | --- | --- |
| `--type` | `magiclink` | `magiclink` and `recovery` need an existing user; `invite` creates one |
| `--redirect-to` | `$SITE_URL/auth/callback` | where the link lands after Supabase verifies the token |

Paste the printed `action_link` into a browser. It runs the same PKCE callback
(`src/app/(auth)/auth/callback/route.ts`) as a real emailed link — it exchanges
`?code=` for a session and, if `?token=` is present, bounces to
`/invite/<token>`. The script also prints the `otp` value for entering a code by
hand.

Source: `scripts/auth-link.ts`. Script entry: `package.json` → `auth:link`.

### Fallback: pull the link from Auth Logs

If the Admin API is not an option (no service-role key handy, or you want to see
exactly what the built-in sender produced), trigger the email from `/login`, then
open Dashboard → **Logs → Auth Logs**
(`https://supabase.com/dashboard/project/_/logs/auth-logs`). Find the
magic-link / recovery request and copy the confirmation URL (or the token) out of
the log entry, then open it in a browser.
