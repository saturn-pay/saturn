-- Service submissions table for the service registry
CREATE TABLE IF NOT EXISTS "service_submissions" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "service_name" text NOT NULL,
  "service_slug" text NOT NULL,
  "description" text,
  "base_url" text NOT NULL,
  "auth_type" text NOT NULL,
  "auth_credential_env" text NOT NULL,
  "capability" text NOT NULL,
  "proposed_pricing" jsonb,
  "notes" text,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewer_notes" text,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for filtering by status (admin review queries)
CREATE INDEX IF NOT EXISTS "service_submissions_status_idx" ON "service_submissions" ("status");

-- Index for filtering by account (user's own submissions)
CREATE INDEX IF NOT EXISTS "service_submissions_account_idx" ON "service_submissions" ("account_id");
