# AI file capture — Supabase Storage setup

The private `knowledge-capture-staging` bucket temporarily receives up to three
attachments from the Add-knowledge screen. Images are optimized to JPEG in the
browser; PDF and Excel bytes are kept intact for the AI provider. The extraction
action deletes staged objects on every exit path, and a scheduled sweep is the
backstop. Confirmed knowledge is saved only after the user reviews it.

## Bucket settings

Configure the bucket as follows:

- Name: `knowledge-capture-staging`
- Public: **off**
- Restrict file size: `5 MB`
- Allowed MIME types:
  - `image/jpeg`
  - `application/pdf`
  - `application/vnd.ms-excel`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## RLS policies on `storage.objects`

For `bucket_id = 'knowledge-capture-staging'`, a user may only touch files
under their own ID prefix. Add SELECT, INSERT, and DELETE policies with the
same `USING` / `WITH CHECK` expression:

    (storage.foldername(name))[1] = auth.uid()::text

No UPDATE policy is required. The sweep uses the service-role key and bypasses
RLS.

## Environment and sweep

- Set `CRON_SECRET` in Vercel. The sweep returns 503 without it.
- `vercel.json` schedules `/api/cron/sweep-capture-staging` daily at 03:00.
  The inline deletion is primary; the sweep clears objects left behind if a tab
  closes mid-upload.

## Feature behavior

The AI picker is hidden until `AI_API_KEY` is configured. It accepts photos,
PDFs, `.xls`, and `.xlsx` files (up to three files, 5 MB each). Attachments are
temporary: the reviewed knowledge items, not the source file, are persisted.

## Verify the sweep

Upload a file and close the tab before selecting “Structure with AI.” Once it
is older than the route cutoff, invoke the cron route with the bearer secret and
confirm the object is deleted. If a nested object is not found, the sweep needs
per-folder `list()` iteration.
