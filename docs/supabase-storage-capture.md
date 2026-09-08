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
- `vercel.json` already registers the hourly cron.

## 4. Feature gate

The whole AI-capture step (text and photos) stays hidden until `AI_API_KEY` is
set, exactly as in Phase 4. The bucket and cron can be created ahead of that
with no user-visible effect.
