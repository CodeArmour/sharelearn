/** The transient staging bucket for AI photo capture (Backend Phase 5). Objects
 *  here are deleted as soon as extraction finishes, with a daily sweep by
 *  `/api/cron/sweep-capture-staging` as the backstop. Client- and server-safe
 *  (no `server-only`). */
export const CAPTURE_BUCKET = "knowledge-capture-staging";
