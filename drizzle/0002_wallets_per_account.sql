-- Migration: Move wallets from per-agent to per-account
-- Handles existing data by copying account_id from agents table

-- Step 1: Add account_id as nullable first
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "account_id" text REFERENCES "accounts"("id");

-- Step 2: Populate account_id from existing agent relationships
UPDATE "wallets" w
SET "account_id" = a."account_id"
FROM "agents" a
WHERE w."agent_id" = a."id"
  AND w."account_id" IS NULL;

-- Step 3: Make account_id NOT NULL now that it's populated
ALTER TABLE "wallets" ALTER COLUMN "account_id" SET NOT NULL;

-- Step 4: Add unique constraint on account_id
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_account_id_unique" UNIQUE ("account_id");

-- Step 5: Drop old agent_id column and constraints
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_agent_id_agents_id_fk";
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_agent_id_unique";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "agent_id";

-- Step 6: Add agent_id to transactions for tracking
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "agent_id" text;
