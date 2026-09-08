/** The transient staging bucket for AI photo capture (Backend Phase 5). Objects
 *  here are deleted as soon as extraction finishes and swept hourly by
 *  `/api/cron/sweep-capture-staging`. Client- and server-safe (no `server-only`). */
export const CAPTURE_BUCKET = "knowledge-capture-staging";
