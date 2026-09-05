// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * resetTables() has wiped the live shared dev Supabase database twice by
 * running an unscoped TRUNCATE against it when TEST_DATABASE_URL was
 * pointed at the same project as SUPABASE_DB_DIRECT_URL/SUPABASE_DB_POOL_URL.
 * These tests lock in the guard added to prevent a third incident.
 */
describe("sameDatabase", () => {
  it("matches same host+path regardless of credentials, port, or query params", async () => {
    const { sameDatabase } = await import("./db");
    expect(
      sameDatabase(
        "postgresql://user:pass@example.supabase.co:6543/postgres?pgbouncer=true",
        "postgresql://other:otherpass@example.supabase.co:5432/postgres",
      ),
    ).toBe(true);
  });

  it("does not match a genuinely different host", async () => {
    const { sameDatabase } = await import("./db");
    expect(
      sameDatabase(
        "postgresql://user:pass@disposable-test-db.example.com:5432/postgres",
        "postgresql://user:pass@example.supabase.co:5432/postgres",
      ),
    ).toBe(false);
  });

  it("does not match a different database name on the same host", async () => {
    const { sameDatabase } = await import("./db");
    expect(
      sameDatabase(
        "postgresql://user:pass@example.supabase.co:5432/test_disposable",
        "postgresql://user:pass@example.supabase.co:5432/postgres",
      ),
    ).toBe(false);
  });
});

describe("resetTables safety guard", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("refuses to run when TEST_DATABASE_URL matches SUPABASE_DB_DIRECT_URL", async () => {
    vi.resetModules();
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@example.supabase.co:5432/postgres";
    process.env.SUPABASE_DB_DIRECT_URL =
      "postgresql://other-user:otherpass@example.supabase.co:5432/postgres";
    delete process.env.SUPABASE_DB_POOL_URL;
    const { resetTables } = await import("./db");
    await expect(resetTables()).rejects.toThrow(/Refusing to run resetTables/);
  });

  it("refuses to run when TEST_DATABASE_URL matches SUPABASE_DB_POOL_URL, ignoring query params", async () => {
    vi.resetModules();
    process.env.TEST_DATABASE_URL = "postgresql://user:pass@example.supabase.co:6543/postgres";
    delete process.env.SUPABASE_DB_DIRECT_URL;
    process.env.SUPABASE_DB_POOL_URL =
      "postgresql://other-user:otherpass@example.supabase.co:6543/postgres?pgbouncer=true";
    const { resetTables } = await import("./db");
    await expect(resetTables()).rejects.toThrow(/Refusing to run resetTables/);
  });

  it("does nothing when TEST_DATABASE_URL is unset", async () => {
    vi.resetModules();
    delete process.env.TEST_DATABASE_URL;
    const { resetTables } = await import("./db");
    await expect(resetTables()).resolves.toBeUndefined();
  });
});
