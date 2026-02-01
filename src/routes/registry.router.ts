import { Router } from 'express';
import type { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { services, serviceSubmissions } from '../db/schema/index.js';
import { requireAccount } from '../middleware/auth.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES } from '../config/constants.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';
import { isCapability } from '../services/proxy/capability-registry.js';

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

export const registryRouter = Router();

registryRouter.use(requireAccount);

// ---------------------------------------------------------------------------
// POST /submit — submit a service for review
// ---------------------------------------------------------------------------

registryRouter.post('/submit', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const {
    serviceName,
    serviceSlug,
    description,
    baseUrl,
    authType,
    authCredentialEnv,
    capability,
    proposedPricing,
    notes,
  } = req.body;

  // Validation
  if (!serviceName || typeof serviceName !== 'string') {
    throw new ValidationError('serviceName is required');
  }
  if (!serviceSlug || typeof serviceSlug !== 'string') {
    throw new ValidationError('serviceSlug is required');
  }
  if (!/^[a-z0-9-]+$/.test(serviceSlug)) {
    throw new ValidationError('serviceSlug must be lowercase alphanumeric with hyphens');
  }
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new ValidationError('baseUrl is required');
  }
  if (!authType || !['bearer', 'api_key_header', 'basic', 'query_param'].includes(authType)) {
    throw new ValidationError('authType must be one of: bearer, api_key_header, basic, query_param');
  }
  if (!authCredentialEnv || typeof authCredentialEnv !== 'string') {
    throw new ValidationError('authCredentialEnv is required');
  }
  if (!capability || !isCapability(capability)) {
    throw new ValidationError('capability must be a valid capability verb');
  }
  if (proposedPricing) {
    if (!Array.isArray(proposedPricing)) {
      throw new ValidationError('proposedPricing must be an array');
    }
    for (const entry of proposedPricing) {
      if (!entry.operation || !entry.costUsdMicros || !entry.priceUsdMicros || !entry.unit) {
        throw new ValidationError('Each proposedPricing entry requires: operation, costUsdMicros, priceUsdMicros, unit');
      }
    }
  }

  // Uniqueness check against services and pending/approved submissions
  const [existingService] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.slug, serviceSlug));

  if (existingService) {
    throw new ValidationError(`Service slug '${serviceSlug}' is already in use`);
  }

  const [existingSubmission] = await db
    .select({ id: serviceSubmissions.id })
    .from(serviceSubmissions)
    .where(
      and(
        eq(serviceSubmissions.serviceSlug, serviceSlug),
        eq(serviceSubmissions.status, 'pending'),
      ),
    );

  if (existingSubmission) {
    throw new ValidationError(`A pending submission for slug '${serviceSlug}' already exists`);
  }

  const id = generateId(ID_PREFIXES.submission);
  const now = new Date();

  await db.insert(serviceSubmissions).values({
    id,
    accountId,
    serviceName,
    serviceSlug,
    description: description ?? null,
    baseUrl,
    authType,
    authCredentialEnv,
    capability,
    proposedPricing: proposedPricing ?? null,
    notes: notes ?? null,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  const [submission] = await db
    .select()
    .from(serviceSubmissions)
    .where(eq(serviceSubmissions.id, id));

  res.status(201).json(submission);
});

// ---------------------------------------------------------------------------
// GET /submissions — list own submissions
// ---------------------------------------------------------------------------

registryRouter.get('/submissions', async (req: Request, res: Response) => {
  const accountId = req.account!.id;

  const rows = await db
    .select()
    .from(serviceSubmissions)
    .where(eq(serviceSubmissions.accountId, accountId))
    .orderBy(serviceSubmissions.createdAt);

  res.json(rows);
});

// ---------------------------------------------------------------------------
// GET /submissions/:id — get own submission detail
// ---------------------------------------------------------------------------

registryRouter.get('/submissions/:id', async (req: Request, res: Response) => {
  const accountId = req.account!.id;
  const submissionId = paramString(req.params.id);

  const [submission] = await db
    .select()
    .from(serviceSubmissions)
    .where(
      and(
        eq(serviceSubmissions.id, submissionId),
        eq(serviceSubmissions.accountId, accountId),
      ),
    );

  if (!submission) {
    throw new NotFoundError('Submission', submissionId);
  }

  res.json(submission);
});
