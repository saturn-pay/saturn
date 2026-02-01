/**
 * Registry Service — approval logic, auto-wiring, and startup loader.
 *
 * "The service registry exists to control what Saturn operates, not to enable
 * provider self-service."
 *
 * Saturn curates its capability providers. The registry is an intake funnel for
 * that curation — not a marketplace, not self-serve onboarding.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { services, servicePricing, serviceSubmissions } from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES } from '../config/constants.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { usdMicrosToSats, getCurrentRate } from './pricing.service.js';
import { GenericHttpAdapter } from './proxy/adapters/generic-http.adapter.js';
import { registerAdapter } from './proxy/adapter-registry.js';
import { addProvider } from './proxy/capability-registry.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposedPricingEntry {
  operation: string;
  costUsdMicros: number;
  priceUsdMicros: number;
  unit: 'per_request' | 'per_1k_tokens' | 'per_minute';
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

export async function approveSubmission(
  submissionId: string,
  reviewerNotes?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Load submission
    const [submission] = await tx
      .select()
      .from(serviceSubmissions)
      .where(eq(serviceSubmissions.id, submissionId));

    if (!submission) {
      throw new NotFoundError('Submission', submissionId);
    }
    if (submission.status !== 'pending') {
      throw new ValidationError(`Submission is already ${submission.status}`);
    }

    // 2. Insert into services table
    const serviceId = generateId(ID_PREFIXES.service);
    const now = new Date();

    await tx.insert(services).values({
      id: serviceId,
      slug: submission.serviceSlug,
      name: submission.serviceName,
      description: submission.description,
      tier: 'community',
      status: 'active',
      baseUrl: submission.baseUrl,
      authType: submission.authType,
      authCredentialEnv: submission.authCredentialEnv,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Insert pricing from proposed_pricing
    const pricing = (submission.proposedPricing ?? []) as ProposedPricingEntry[];
    const { btcUsd } = getCurrentRate();

    for (const entry of pricing) {
      const priceSats = usdMicrosToSats(entry.priceUsdMicros, btcUsd);

      await tx.insert(servicePricing).values({
        id: generateId(ID_PREFIXES.servicePricing),
        serviceId,
        operation: entry.operation,
        costUsdMicros: entry.costUsdMicros,
        priceUsdMicros: entry.priceUsdMicros,
        priceSats,
        unit: entry.unit,
        updatedAt: now,
      });
    }

    // 4. Create GenericHttpAdapter and register it
    const adapter = new GenericHttpAdapter({
      slug: submission.serviceSlug,
      baseUrl: submission.baseUrl,
      authType: submission.authType,
      authCredentialEnv: submission.authCredentialEnv,
      defaultOperation: pricing.length > 0 ? pricing[0].operation : 'default',
    });
    registerAdapter(adapter);

    // 5. Add provider to capability registry
    // Community services get lower priority (100+) so they don't override curated providers
    addProvider(submission.capability, submission.serviceSlug, 100);

    // 6. Update submission status
    await tx
      .update(serviceSubmissions)
      .set({
        status: 'approved',
        reviewerNotes: reviewerNotes ?? null,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(serviceSubmissions.id, submissionId));

    logger.info(
      { submissionId, slug: submission.serviceSlug, capability: submission.capability },
      'Service submission approved and auto-wired',
    );
  });
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

export async function rejectSubmission(
  submissionId: string,
  reviewerNotes?: string,
): Promise<void> {
  const now = new Date();

  const [submission] = await db
    .select()
    .from(serviceSubmissions)
    .where(eq(serviceSubmissions.id, submissionId));

  if (!submission) {
    throw new NotFoundError('Submission', submissionId);
  }
  if (submission.status !== 'pending') {
    throw new ValidationError(`Submission is already ${submission.status}`);
  }

  await db
    .update(serviceSubmissions)
    .set({
      status: 'rejected',
      reviewerNotes: reviewerNotes ?? null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(serviceSubmissions.id, submissionId));

  logger.info({ submissionId, slug: submission.serviceSlug }, 'Service submission rejected');
}

// ---------------------------------------------------------------------------
// Startup loader — re-wire previously approved community services
// ---------------------------------------------------------------------------

export async function loadApprovedServices(): Promise<void> {
  // Find all active community services
  const communityServices = await db
    .select()
    .from(services)
    .where(and(eq(services.tier, 'community'), eq(services.status, 'active')));

  if (communityServices.length === 0) {
    logger.info('No community services to load');
    return;
  }

  let loaded = 0;

  for (const svc of communityServices) {
    // Find the matching approved submission for capability mapping
    const [submission] = await db
      .select()
      .from(serviceSubmissions)
      .where(
        and(
          eq(serviceSubmissions.serviceSlug, svc.slug),
          eq(serviceSubmissions.status, 'approved'),
        ),
      );

    if (!submission) {
      logger.warn({ slug: svc.slug }, 'Community service has no approved submission, skipping');
      continue;
    }

    // Find the first pricing entry for defaultOperation
    const [firstPricing] = await db
      .select()
      .from(servicePricing)
      .where(eq(servicePricing.serviceId, svc.id));

    const adapter = new GenericHttpAdapter({
      slug: svc.slug,
      baseUrl: svc.baseUrl,
      authType: svc.authType,
      authCredentialEnv: svc.authCredentialEnv,
      defaultOperation: firstPricing?.operation ?? 'default',
    });

    registerAdapter(adapter);
    addProvider(submission.capability, svc.slug, 100);
    loaded++;
  }

  logger.info({ count: loaded }, 'Community services loaded and wired');
}
