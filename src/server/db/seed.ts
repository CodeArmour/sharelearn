import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

import { deriveAccent, deriveInitials } from "@/server/auth/identity";
import * as schema from "@/server/db/schema";

const { groupMemberships, groups, profiles } = schema;

const email = process.env.OWNER_EMAIL;
const groupName = process.env.OWNER_GROUP_NAME ?? "Dutch Study Group";
if (!email) throw new Error("OWNER_EMAIL is required");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_DIRECT_URL;
if (!supabaseUrl || !serviceKey || !dbUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_DIRECT_URL are required",
  );
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(dbUrl);
const db = drizzle(sql, { schema });

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "group"
  );
}

async function main() {
  // 1. Ensure the auth user exists and is confirmed.
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  let user = list.users.find(
    (u) => u.email?.toLowerCase() === email!.toLowerCase(),
  );
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: email!,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  const userId = user!.id;

  // 2. Upsert the group by slug.
  const slug = slugify(groupName);
  let [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);
  if (!group) {
    [group] = await db
      .insert(groups)
      .values({ name: groupName, slug, createdBy: userId })
      .returning();
  }

  // 3. Upsert the owner profile + membership.
  await db
    .insert(profiles)
    .values({
      id: userId,
      displayName: email!.split("@")[0],
      initials: deriveInitials(email!),
      accent: deriveAccent(userId),
    })
    .onConflictDoNothing();

  await db
    .insert(groupMemberships)
    .values({ groupId: group.id, userId, role: "owner" })
    .onConflictDoNothing();

  console.log(
    `Seeded owner ${email} into group "${groupName}" (${group.id}).`,
  );
}

main()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    try {
      await sql.end();
    } catch {
      // ignore
    }
    process.exit(1);
  });
