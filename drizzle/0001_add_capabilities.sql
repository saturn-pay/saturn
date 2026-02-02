-- Add capability column to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "capability" text;

-- Add capability allow/deny arrays to policies
ALTER TABLE "policies" ADD COLUMN "allowed_capabilities" text[];
ALTER TABLE "policies" ADD COLUMN "denied_capabilities" text[];
