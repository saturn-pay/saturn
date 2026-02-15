-- Fix: Add LemonSqueezy columns if they don't exist (idempotent)

DO $$
BEGIN
    -- Add provider column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkout_sessions' AND column_name = 'provider') THEN
        ALTER TABLE checkout_sessions ADD COLUMN provider text NOT NULL DEFAULT 'stripe';
    END IF;

    -- Add lemon_checkout_id column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkout_sessions' AND column_name = 'lemon_checkout_id') THEN
        ALTER TABLE checkout_sessions ADD COLUMN lemon_checkout_id text UNIQUE;
    END IF;

    -- Add lemon_order_id column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checkout_sessions' AND column_name = 'lemon_order_id') THEN
        ALTER TABLE checkout_sessions ADD COLUMN lemon_order_id text UNIQUE;
    END IF;
END $$;
--> statement-breakpoint
-- Make stripe_session_id nullable if it's not already
ALTER TABLE checkout_sessions ALTER COLUMN stripe_session_id DROP NOT NULL;
--> statement-breakpoint
-- Add index if not exists
CREATE INDEX IF NOT EXISTS checkout_sessions_lemon_checkout_idx ON checkout_sessions (lemon_checkout_id);
