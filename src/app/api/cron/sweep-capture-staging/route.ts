import { CAPTURE_BUCKET } from "@/lib/supabase/constants";
import { createAdminSupabaseClient } from "@/server/auth/supabase";

const MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Hourly backstop that deletes any AI-capture staging photo older than an hour.
 * `extractFromPhotosAction` deletes them inline on every exit path; this only
 * catches objects orphaned when the browser tab closed mid-flow.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. A missing
 * `CRON_SECRET` is a deploy misconfiguration → 503 (fail loud, sweep nothing).
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const bucket = supabase.storage.from(CAPTURE_BUCKET);

  const { data, error } = await bucket.list("", { limit: 1000 });
  if (error) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  const cutoff = Date.now() - MAX_AGE_MS;
  const stale = (data ?? [])
    .filter((o) => o.created_at != null && new Date(o.created_at).getTime() < cutoff)
    .map((o) => o.name);

  if (stale.length > 0) {
    await bucket.remove(stale);
  }
  return Response.json({ deleted: stale.length });
}
