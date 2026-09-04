import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
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

export const knowledgeType = pgEnum("knowledge_type", [
  "vocabulary",
  "grammar",
  "reading",
  "note",
]);
export const knowledgeSource = pgEnum("knowledge_source", [
  "manual",
  "photo",
  "file-upload",
  "ai-assisted",
]);
export const dutchArticle = pgEnum("dutch_article", ["de", "het"]);

/** One row per shared-library item. Nullable per-type columns rather than
 * per-type child tables — Today/Library/search/practice all need mixed-type
 * lists as the primary access pattern; joining four tables on every read
 * would cost more than it buys at this scale. */
export const knowledgeItems = pgTable(
  "knowledge_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    type: knowledgeType("type").notNull(),
    // Free-text CEFR code; constrained by a CHECK below rather than a second
    // enum, so CEFR_LEVELS (src/types/cefr.ts) doesn't require a migration
    // whenever it changes.
    level: text("level"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    source: knowledgeSource("source").notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // vocabulary
    term: text("term"),
    meaning: text("meaning"),
    partOfSpeech: text("part_of_speech"),
    example: text("example"),
    exampleTranslation: text("example_translation"),
    article: dutchArticle("article"),
    plural: text("plural"),
    pastTense: text("past_tense"),
    perfect: text("perfect"),
    usageNote: text("usage_note"),
    // grammar (title/summary also used by reading/note below)
    title: text("title"),
    summary: text("summary"),
    explanation: text("explanation"),
    examples: jsonb("examples").$type<{ nl: string; en: string | null }[]>(),
    // reading / note
    body: text("body"),
    wordCount: integer("word_count"),
    vocabularyIds: uuid("vocabulary_ids").array(),
  },
  (t) => [
    index("knowledge_items_group_idx").on(t.groupId),
    index("knowledge_items_group_type_idx").on(t.groupId, t.type),
    index("knowledge_items_added_by_idx").on(t.addedBy),
    check(
      "knowledge_items_vocabulary_fields",
      sql`${t.type} <> 'vocabulary' OR (${t.term} IS NOT NULL AND ${t.meaning} IS NOT NULL AND ${t.partOfSpeech} IS NOT NULL)`,
    ),
    check(
      "knowledge_items_grammar_fields",
      sql`${t.type} <> 'grammar' OR (${t.title} IS NOT NULL AND ${t.summary} IS NOT NULL AND ${t.explanation} IS NOT NULL)`,
    ),
    check(
      "knowledge_items_reading_fields",
      sql`${t.type} <> 'reading' OR (${t.title} IS NOT NULL AND ${t.body} IS NOT NULL)`,
    ),
    check("knowledge_items_note_fields", sql`${t.type} <> 'note' OR ${t.body} IS NOT NULL`),
    check(
      "knowledge_items_level_values",
      sql`${t.level} IS NULL OR ${t.level} IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    ),
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
export type KnowledgeItemRow = typeof knowledgeItems.$inferSelect;
export type NewKnowledgeItemRow = typeof knowledgeItems.$inferInsert;
