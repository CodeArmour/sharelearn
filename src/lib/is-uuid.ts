const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `value` is a canonical UUID string.
 *
 * Two call sites depend on this:
 * - Postgres `uuid` columns reject non-uuid input with a hard `22P02` error,
 *   so id-shaped input is narrowed before it reaches a query.
 * - Pre-Phase-2 mock ids (e.g. `kn_gezellig`) can still sit in a client's
 *   `localStorage` review marks; they're filtered out rather than rejecting
 *   the whole array.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
