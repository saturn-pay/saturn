-- Add password authentication to accounts
ALTER TABLE "accounts" ADD COLUMN "password_hash" text;

-- Create index on email for login lookups
CREATE INDEX IF NOT EXISTS "accounts_email_idx" ON "accounts" ("email");
