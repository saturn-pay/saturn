import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const serviceSubmissions = pgTable('service_submissions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  serviceName: text('service_name').notNull(),
  serviceSlug: text('service_slug').notNull(),
  description: text('description'),
  baseUrl: text('base_url').notNull(),
  authType: text('auth_type', { enum: ['bearer', 'api_key_header', 'basic', 'query_param'] }).notNull(),
  authCredentialEnv: text('auth_credential_env').notNull(),
  capability: text('capability').notNull(),
  proposedPricing: jsonb('proposed_pricing'),
  notes: text('notes'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  reviewerNotes: text('reviewer_notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
