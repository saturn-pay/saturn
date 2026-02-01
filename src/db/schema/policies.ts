import { pgTable, text, bigint, boolean, timestamp } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const policies = pgTable('policies', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  maxPerCallSats: bigint('max_per_call_sats', { mode: 'number' }),
  maxPerDaySats: bigint('max_per_day_sats', { mode: 'number' }),
  allowedServices: text('allowed_services').array(),
  deniedServices: text('denied_services').array(),
  killSwitch: boolean('kill_switch').notNull().default(false),
  maxBalanceSats: bigint('max_balance_sats', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
