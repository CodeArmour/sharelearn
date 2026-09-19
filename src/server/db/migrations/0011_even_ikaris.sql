CREATE TYPE "public"."learning_goal" AS ENUM('relocating', 'work_study', 'family', 'curious');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "full_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "nickname" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "cefr_level" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "learning_goal" "learning_goal";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_cefr_level_values" CHECK ("profiles"."cefr_level" IS NULL OR "profiles"."cefr_level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));