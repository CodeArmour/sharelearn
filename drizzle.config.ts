import { defineConfig } from "drizzle-kit";

// Migrations run against the DIRECT connection (port 5432), never the pooler.
const url = process.env.SUPABASE_DB_DIRECT_URL;
if (!url) throw new Error("SUPABASE_DB_DIRECT_URL is required for drizzle-kit");

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  // Never manage Supabase's own `auth` schema.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
