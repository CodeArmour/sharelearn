# AI photo capture — Supabase Storage setup (Backend Phase 5)

One private bucket backs the "Upload photos" mode on the Add-knowledge screen.
Photos live in it only for the seconds a vision call takes; they're deleted
inline and swept hourly. Nothing here is created by a migration — do it once in
the dashboard.

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

No UPDATE policy. The hourly sweep uses the service-role key and bypasses RLS.

## 3. Env

- `CRON_SECRET` — set on Vercel (all environments). Any long random string.
  `/api/cron/sweep-capture-staging` returns 503 without it.
- `vercel.json` already registers the hourly cron. Note: the Vercel **Hobby**
  plan caps cron to once per day, so `0 * * * *` needs **Pro**. On Hobby, use a
  daily schedule instead (e.g. `0 3 * * *`) in `vercel.json`.

## 4. Feature gate

The whole AI-capture step (text and photos) stays hidden until `AI_API_KEY` is
set, exactly as in Phase 4. The bucket and cron can be created ahead of that
with no user-visible effect.

## 5. Verify the sweep actually deletes

Supabase `list("")` on a one-level-nested bucket *may* return folder entries
(no `created_at`) rather than files — in which case the route returns
`{ deleted: 0 }` forever. Do this positive check once: upload a photo via the
Add screen and close the tab before "Structure with AI" (leaves one staged
object), then either wait an hour or temporarily lower the route's age cutoff,
then `curl` the route with the bearer secret and confirm it reports
`deleted: 1` and the bucket empties. If it reports `deleted: 0` with an object
present, the route needs per-folder `list()` iteration.
