import { pgTable, text, bigint, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  serviceSlug: text('service_slug').notNull(),
  capability: text('capability'),
  operation: text('operation'),
  requestBody: jsonb('request_body'),
  policyResult: text('policy_result', { enum: ['allowed', 'denied'] }).notNull(),
  policyReason: text('policy_reason'),
  quotedSats: bigint('quoted_sats', { mode: 'number' }),
  chargedSats: bigint('charged_sats', { mode: 'number' }),
  upstreamStatus: integer('upstream_status'),
  upstreamLatencyMs: integer('upstream_latency_ms'),
  responseMeta: jsonb('response_meta'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_agent_created_idx').on(table.agentId, table.createdAt),
]);
