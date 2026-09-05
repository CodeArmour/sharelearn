// @vitest-environment node
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/server/db/schema";

const url = process.env.TEST_DATABASE_URL;

/** A Drizzle client bound to the disposable test DB, or null when unset. */
export const testDb = url ? drizzle(postgres(url, { prepare: false }), { schema }) : null;

/**
 * True when `a` and `b` name the same Postgres host+database, ignoring
 * differences in credentials, port, or query params (e.g. the pooler's
 * `?pgbouncer=true`). Falls back to a literal string compare if either
 * value isn't a parseable URL.
 */
export function sameDatabase(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.hostname === ub.hostname && ua.pathname === ub.pathname;
  } catch {
    return a === b;
  }
}

/**
 * `resetTables()` runs an unscoped `TRUNCATE ... CASCADE` — it has already
 * wiped the live shared dev Supabase database twice (once during Backend
 * Phase 2, once during this feature's Task 2), because `TEST_DATABASE_URL`
 * was pointed at the same project as `SUPABASE_DB_DIRECT_URL`/
 * `SUPABASE_DB_POOL_URL`. There is currently no genuinely separate/
 * throwaway test database provisioned for this project, so refuse to run
 * rather than risk a third incident — this intentionally blocks
 * `resetTables()`-based integration tests until one exists. Read-only or
 * rollback-per-test usage of `testDb` (e.g. rls.integration.test.ts's
 * `withRolledBackTx`) is unaffected — this guard only gates the
 * destructive helper.
 */
function assertNotLiveDevDatabase(target: string): void {
  const guarded: Record<string, string | undefined> = {
    SUPABASE_DB_DIRECT_URL: process.env.SUPABASE_DB_DIRECT_URL,
    SUPABASE_DB_POOL_URL: process.env.SUPABASE_DB_POOL_URL,
  };
  for (const [name, devUrl] of Object.entries(guarded)) {
    if (devUrl && sameDatabase(target, devUrl)) {
      throw new Error(
        `Refusing to run resetTables(): TEST_DATABASE_URL points at the same ` +
          `database as ${name}. resetTables() does an unscoped TRUNCATE ... CASCADE ` +
          `and has already wiped the live dev database this way before. Point ` +
          `TEST_DATABASE_URL at a genuinely separate/throwaway database, or — if a ` +
          `test only needs to read/write inside a transaction that gets rolled back ` +
          `— use the testDb export directly with a helper like ` +
          `rls.integration.test.ts's withRolledBackTx instead of resetTables().`,
      );
    }
  }
}

export async function resetTables(): Promise<void> {
  if (!testDb || !url) return;
  assertNotLiveDevDatabase(url);
  await testDb.execute(
    sql`TRUNCATE knowledge_items, invitations, group_memberships, groups, profiles RESTART IDENTITY CASCADE`,
  );
}
