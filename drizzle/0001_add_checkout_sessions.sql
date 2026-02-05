CREATE TABLE IF NOT EXISTS "checkout_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "wallet_id" text NOT NULL REFERENCES "wallets"("id"),
  "stripe_session_id" text UNIQUE NOT NULL,
  "stripe_payment_intent_id" text,
  "amount_usd_cents" integer NOT NULL,
  "btc_usd_rate" numeric NOT NULL,
  "amount_sats" bigint NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_sessions_wallet_idx" ON "checkout_sessions" ("wallet_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_sessions_stripe_session_idx" ON "checkout_sessions" ("stripe_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkout_sessions_status_idx" ON "checkout_sessions" ("status");
