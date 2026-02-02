-- Auth simplification: move to agent-only keys with primary/worker roles
ALTER TABLE agents ADD COLUMN email text;
ALTER TABLE agents ADD COLUMN role text NOT NULL DEFAULT 'worker';
ALTER TABLE accounts DROP COLUMN api_key_hash;
ALTER TABLE accounts ALTER COLUMN email DROP NOT NULL;
