CREATE TYPE "public"."study_run_kind" AS ENUM('practice', 'exam');--> statement-breakpoint
CREATE TABLE "review_marks" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"knowledge_id" uuid NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_marks_user_id_group_id_knowledge_id_pk" PRIMARY KEY("user_id","group_id","knowledge_id")
);
--> statement-breakpoint
CREATE TABLE "study_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" "study_run_kind" NOT NULL,
	"mode" text,
	"scope" text NOT NULL,
	"level" text,
	"question_count" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_runs_mode_kind" CHECK (("study_runs"."kind" = 'practice') = ("study_runs"."mode" IS NOT NULL)),
	CONSTRAINT "study_runs_mode_values" CHECK ("study_runs"."mode" IS NULL OR "study_runs"."mode" IN ('vocabulary', 'grammar', 'reading', 'mixed')),
	CONSTRAINT "study_runs_scope_values" CHECK ("study_runs"."scope" IN ('all', 'today', 'level', 'custom', 'review')),
	CONSTRAINT "study_runs_level_values" CHECK ("study_runs"."level" IS NULL OR "study_runs"."level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "study_runs_counts" CHECK ("study_runs"."question_count" > 0 AND "study_runs"."correct_count" >= 0 AND "study_runs"."correct_count" <= "study_runs"."question_count")
);
--> statement-breakpoint
ALTER TABLE "review_marks" ADD CONSTRAINT "review_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_marks" ADD CONSTRAINT "review_marks_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_marks" ADD CONSTRAINT "review_marks_knowledge_id_knowledge_items_id_fk" FOREIGN KEY ("knowledge_id") REFERENCES "public"."knowledge_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_runs" ADD CONSTRAINT "study_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_runs" ADD CONSTRAINT "study_runs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_marks_user_group_idx" ON "review_marks" USING btree ("user_id","group_id");--> statement-breakpoint
CREATE INDEX "study_runs_user_group_completed_idx" ON "study_runs" USING btree ("user_id","group_id","completed_at");