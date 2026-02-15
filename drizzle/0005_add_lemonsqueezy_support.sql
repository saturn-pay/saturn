-- Add provider column with default 'stripe' for existing records
ALTER TABLE "checkout_sessions" ADD COLUMN "provider" text NOT NULL DEFAULT 'stripe';
--> statement-breakpoint
-- Add LemonSqueezy-specific columns
ALTER TABLE "checkout_sessions" ADD COLUMN "lemon_checkout_id" text UNIQUE;
--> statement-breakpoint
ALTER TABLE "checkout_sessions" ADD COLUMN "lemon_order_id" text UNIQUE;
--> statement-breakpoint
-- Make stripe_session_id nullable (for LemonSqueezy checkouts that won't have it)
ALTER TABLE "checkout_sessions" ALTER COLUMN "stripe_session_id" DROP NOT NULL;
--> statement-breakpoint
-- Add index for LemonSqueezy checkout lookups
CREATE INDEX IF NOT EXISTS "checkout_sessions_lemon_checkout_idx" ON "checkout_sessions" ("lemon_checkout_id");
