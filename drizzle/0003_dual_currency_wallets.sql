-- Migration: Add dual-currency support (USD + sats)
-- Users fund in their preferred currency, spend in that currency, no conversion.

-- Step 1: Add USD balance columns to wallets
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "balance_usd_cents" bigint NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "held_usd_cents" bigint NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "lifetime_in_usd_cents" bigint NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "lifetime_out_usd_cents" bigint NOT NULL DEFAULT 0;

-- Step 2: Add check constraints for USD balances
ALTER TABLE "wallets" ADD CONSTRAINT "balance_usd_non_negative" CHECK (balance_usd_cents >= 0);
ALTER TABLE "wallets" ADD CONSTRAINT "held_usd_non_negative" CHECK (held_usd_cents >= 0);

-- Step 3: Add default currency to accounts
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "default_currency" text NOT NULL DEFAULT 'usd_cents';
ALTER TABLE "accounts" ADD CONSTRAINT "default_currency_valid" CHECK (default_currency IN ('sats', 'usd_cents'));

-- Step 4: Add currency column to transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'sats';
ALTER TABLE "transactions" ADD CONSTRAINT "currency_valid" CHECK (currency IN ('sats', 'usd_cents'));
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "amount_usd_cents" bigint;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "balance_after_usd_cents" bigint;
