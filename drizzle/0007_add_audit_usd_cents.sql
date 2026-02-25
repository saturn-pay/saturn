-- Add USD cents columns to audit_logs for proper cost display

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS quoted_usd_cents bigint;
--> statement-breakpoint
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS charged_usd_cents bigint;
