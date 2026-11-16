CREATE TABLE "notification_keys" (
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_keys_organization_id_key_pk" PRIMARY KEY("organization_id","key")
);
--> statement-breakpoint
ALTER TABLE "notification_keys" ADD CONSTRAINT "notification_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;