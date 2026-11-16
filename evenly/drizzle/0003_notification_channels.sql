CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"notification_id" text NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"send_after" timestamp with time zone NOT NULL,
	"detail" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_sms" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quiet_start" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quiet_end" integer;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_due" ON "deliveries" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "deliveries_org" ON "deliveries" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_dedupe" ON "notifications" USING btree ("organization_id","dedupe_key");