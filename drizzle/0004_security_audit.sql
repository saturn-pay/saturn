-- Security audit: indexes, constraints, and auth prefix column

-- 1. Auth prefix for fast key lookup (avoids full table bcrypt scan)
ALTER TABLE agents ADD COLUMN api_key_prefix text;
CREATE INDEX agents_key_prefix_idx ON agents (api_key_prefix);

-- 2. Backfill existing agents: requires app-level script since we need
--    SHA-256 of the original key (which we don't have). New agents get
--    this on creation. Existing agents fall back to full scan until
--    they rotate their key.

-- 3. Unique constraint on policies per agent (one policy per agent)
ALTER TABLE policies ADD CONSTRAINT policies_agent_id_unique UNIQUE (agent_id);

-- 4. Unique constraint on transactions for idempotent credits
ALTER TABLE transactions ADD CONSTRAINT tx_reference_unique UNIQUE (reference_type, reference_id);

-- 5. Indexes for query performance
CREATE INDEX audit_agent_created_idx ON audit_logs (agent_id, created_at);
CREATE INDEX tx_wallet_created_idx ON transactions (wallet_id, created_at);
CREATE INDEX invoices_wallet_idx ON invoices (wallet_id);
CREATE INDEX invoices_status_expires_idx ON invoices (status, expires_at);
