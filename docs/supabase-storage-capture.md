# AI photo capture — Supabase Storage setup (Backend Phase 5)

One private bucket backs the "Upload photos" mode on the Add-knowledge screen.
Photos live in it only for the seconds a vision call takes; they're deleted
inline on every exit path, with a scheduled sweep as the backstop. Nothing here
is created by a migration — do it once in the dashboard.

## 1. Bucket

Storage → New bucket:
- Name: `knowledge-capture-staging`
- Public: **off**
- Restrict file size: `2 MB`
- Allowed MIME types: `image/jpeg`

## 2. RLS policies on `storage.objects`

For `bucket_id = 'knowledge-capture-staging'`, a user may only touch files
under their own id prefix. Add three policies (SELECT, INSERT, DELETE), same
`USING` / `WITH CHECK` expression:

    (storage.foldername(name))[1] = auth.uid()::text

No UPDATE policy. The sweep uses the service-role key and bypasses RLS.

## 3. Env

- `CRON_SECRET` — set on Vercel (all environments). Any long random string.
  `/api/cron/sweep-capture-staging` returns 503 without it.
- `vercel.json` registers the sweep as a **daily** cron (`0 3 * * *`) — the
  Vercel **Hobby** plan caps cron to once per day. On **Pro** you can tighten it
  to hourly (`0 * * * *`) if you want orphaned staging objects (from a tab
  closed mid-flow) cleared within the hour rather than within a day; the inline
  delete is the primary mechanism either way, so a daily backstop is fine.

## 4. Feature gate

The whole AI-capture step (text and photos) stays hidden until `AI_API_KEY` is
set, exactly as in Phase 4. The bucket and cron can be created ahead of that
with no user-visible effect.

## 5. Verify the sweep actually deletes

Supabase `list("")` on a one-level-nested bucket *may* return folder entries
(no `created_at`) rather than files — in which case the route returns
`{ deleted: 0 }` forever. Do this positive check once: upload a photo via the
Add screen and close the tab before "Structure with AI" (leaves one staged
object older than the 1-hour cutoff after an hour), then `curl` the route with
the bearer secret — `curl -H "Authorization: Bearer $CRON_SECRET"
https://<app>/api/cron/sweep-capture-staging` — and confirm it reports
`deleted: 1` and the bucket empties. (To avoid the hour wait, temporarily drop
`MAX_AGE_MS` in the route.) If it reports `deleted: 0` with an aged object
present, the route needs per-folder `list()` iteration.
