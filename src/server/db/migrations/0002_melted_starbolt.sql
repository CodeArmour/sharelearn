CREATE TYPE "public"."dutch_article" AS ENUM('de', 'het');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source" AS ENUM('manual', 'photo', 'file-upload', 'ai-assisted');--> statement-breakpoint
CREATE TYPE "public"."knowledge_type" AS ENUM('vocabulary', 'grammar', 'reading', 'note');--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"type" "knowledge_type" NOT NULL,
	"level" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" "knowledge_source" NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"term" text,
	"meaning" text,
	"part_of_speech" text,
	"example" text,
	"example_translation" text,
	"article" "dutch_article",
	"plural" text,
	"past_tense" text,
	"perfect" text,
	"usage_note" text,
	"title" text,
	"summary" text,
	"explanation" text,
	"examples" jsonb,
	"body" text,
	"word_count" integer,
	"vocabulary_ids" uuid[],
	CONSTRAINT "knowledge_items_vocabulary_fields" CHECK ("knowledge_items"."type" <> 'vocabulary' OR ("knowledge_items"."term" IS NOT NULL AND "knowledge_items"."meaning" IS NOT NULL AND "knowledge_items"."part_of_speech" IS NOT NULL)),
	CONSTRAINT "knowledge_items_grammar_fields" CHECK ("knowledge_items"."type" <> 'grammar' OR ("knowledge_items"."title" IS NOT NULL AND "knowledge_items"."summary" IS NOT NULL AND "knowledge_items"."explanation" IS NOT NULL)),
	CONSTRAINT "knowledge_items_reading_fields" CHECK ("knowledge_items"."type" <> 'reading' OR ("knowledge_items"."title" IS NOT NULL AND "knowledge_items"."body" IS NOT NULL)),
	CONSTRAINT "knowledge_items_note_fields" CHECK ("knowledge_items"."type" <> 'note' OR "knowledge_items"."body" IS NOT NULL),
	CONSTRAINT "knowledge_items_level_values" CHECK ("knowledge_items"."level" IS NULL OR "knowledge_items"."level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
);
--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_items_group_idx" ON "knowledge_items" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "knowledge_items_group_type_idx" ON "knowledge_items" USING btree ("group_id","type");--> statement-breakpoint
CREATE INDEX "knowledge_items_added_by_idx" ON "knowledge_items" USING btree ("added_by");