import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/server/env";

import * as schema from "./schema";

// PgBouncer (transaction mode) does not support prepared statements.
const queryClient = postgres(serverEnv.dbPoolUrl, { prepare: false });

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
