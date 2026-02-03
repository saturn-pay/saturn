-- Initial schema: all base tables for Saturn
-- This migration creates the complete database schema from scratch.

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "accounts"("id"),
  "name" text NOT NULL,
  "api_key_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL UNIQUE REFERENCES "agents"("id"),
  "balance_sats" bigint NOT NULL DEFAULT 0,
  "held_sats" bigint NOT NULL DEFAULT 0,
  "lifetime_in" bigint NOT NULL DEFAULT 0,
  "lifetime_out" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "balance_non_negative" CHECK ("balance_sats" >= 0),
  CONSTRAINT "held_non_negative" CHECK ("held_sats" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policies" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id"),
  "max_per_call_sats" bigint,
  "max_per_day_sats" bigint,
  "allowed_services" text[],
  "denied_services" text[],
  "kill_switch" boolean NOT NULL DEFAULT false,
  "max_balance_sats" bigint,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text UNIQUE NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "tier" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "base_url" text NOT NULL,
  "auth_type" text NOT NULL,
  "auth_credential_env" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "service_pricing" (
  "id" text PRIMARY KEY NOT NULL,
  "service_id" text NOT NULL REFERENCES "services"("id"),
  "operation" text NOT NULL,
  "cost_usd_micros" bigint NOT NULL,
  "price_usd_micros" bigint NOT NULL,
  "price_sats" bigint NOT NULL,
  "unit" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_operation_unique" UNIQUE ("service_id", "operation")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" text PRIMARY KEY NOT NULL,
  "wallet_id" text NOT NULL REFERENCES "wallets"("id"),
  "amount_sats" bigint NOT NULL,
  "payment_request" text NOT NULL,
  "r_hash" text UNIQUE NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp with time zone NOT NULL,
  "settled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "wallet_id" text NOT NULL REFERENCES "wallets"("id"),
  "type" text NOT NULL,
  "amount_sats" bigint NOT NULL,
  "balance_after" bigint NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id"),
  "service_slug" text NOT NULL,
  "operation" text,
  "request_body" jsonb,
  "policy_result" text NOT NULL,
  "policy_reason" text,
  "quoted_sats" bigint,
  "charged_sats" bigint,
  "upstream_status" integer,
  "upstream_latency_ms" integer,
  "response_meta" jsonb,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "btc_usd" numeric(16, 2) NOT NULL,
  "source" text NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL
);
