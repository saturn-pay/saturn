-- Drop agent_id FK and unique constraint from wallets
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_agent_id_agents_id_fk";
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_agent_id_unique";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "agent_id";

-- Add account_id column
ALTER TABLE "wallets" ADD COLUMN "account_id" text NOT NULL REFERENCES "accounts"("id");
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_account_id_unique" UNIQUE ("account_id");

-- Add agent_id to transactions
ALTER TABLE "transactions" ADD COLUMN "agent_id" text;
