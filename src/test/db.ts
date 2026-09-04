// @vitest-environment node
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/server/db/schema";

const url = process.env.TEST_DATABASE_URL;

/** A Drizzle client bound to the disposable test DB, or null when unset. */
export const testDb = url ? drizzle(postgres(url, { prepare: false }), { schema }) : null;

export async function resetTables(): Promise<void> {
  if (!testDb) return;
  await testDb.execute(
    sql`TRUNCATE knowledge_items, invitations, group_memberships, groups, profiles RESTART IDENTITY CASCADE`,
  );
}
