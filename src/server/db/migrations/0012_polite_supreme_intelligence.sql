UPDATE "profiles" SET "full_name" = "display_name", "nickname" = "display_name" WHERE "nickname" = '';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "full_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "nickname" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "display_name";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "initials";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "accent";
