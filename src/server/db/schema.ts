import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Backend Phase 1 schema — auth/groups/invitations only.
 * FKs reference Supabase's managed `auth.users`; that table is declared here
 * purely for typing and is excluded from migrations via `schemaFilter: ["public"]`
 * in `drizzle.config.ts`.
 */

const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  initials: text("initials").notNull(),
  accent: text("accent").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => authUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("group_memberships_group_user_key").on(t.groupId, t.userId),
    index("group_memberships_user_idx").on(t.userId),
    index("group_memberships_group_idx").on(t.groupId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    // `citext` is created in migration 0001; Drizzle treats it as text.
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    role: memberRole("role").notNull().default("member"),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => authUsers.id),
    status: invitationStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invitations_email_idx").on(t.email),
    index("invitations_token_idx").on(t.token),
    uniqueIndex("invitations_group_email_pending_key")
      .on(t.groupId, t.email)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMembership = typeof groupMemberships.$inferSelect;
export type NewGroupMembership = typeof groupMemberships.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
