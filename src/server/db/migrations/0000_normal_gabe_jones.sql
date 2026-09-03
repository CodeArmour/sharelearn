CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"initials" text NOT NULL,
	"accent" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_group_user_key" ON "group_memberships" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_memberships_user_idx" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_memberships_group_idx" ON "group_memberships" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_group_email_pending_key" ON "invitations" USING btree ("group_id","email") WHERE "invitations"."status" = 'pending';