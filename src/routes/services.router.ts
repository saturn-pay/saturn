import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db/client.js';
import { services, servicePricing } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../lib/errors.js';
import { getAllCapabilities, getCapability } from '../services/proxy/capability-registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const servicesRouter = Router();

// GET /services — list all active services with current sats pricing
servicesRouter.get('/', async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: services.id,
      slug: services.slug,
      name: services.name,
      description: services.description,
      tier: services.tier,
      status: services.status,
      baseUrl: services.baseUrl,
      authType: services.authType,
    })
    .from(services)
    .where(eq(services.status, 'active'));

  // Attach pricing summaries for each service
  const result = await Promise.all(
    rows.map(async (svc) => {
      const pricing = await db
        .select({
          operation: servicePricing.operation,
          priceUsdMicros: servicePricing.priceUsdMicros,
          priceSats: servicePricing.priceSats,
          unit: servicePricing.unit,
        })
        .from(servicePricing)
        .where(eq(servicePricing.serviceId, svc.id));

      return { ...svc, pricing };
    }),
  );

  res.json(result);
});

// GET /services/:slug — single service detail + all operations + pricing
servicesRouter.get('/:slug', async (req: Request, res: Response) => {
  const slug = paramString(req.params.slug);

  const [svc] = await db
    .select()
    .from(services)
    .where(eq(services.slug, slug));

  if (!svc) {
    throw new NotFoundError('Service', slug);
  }

  const pricing = await db
    .select({
      id: servicePricing.id,
      operation: servicePricing.operation,
      costUsdMicros: servicePricing.costUsdMicros,
      priceUsdMicros: servicePricing.priceUsdMicros,
      priceSats: servicePricing.priceSats,
      unit: servicePricing.unit,
      updatedAt: servicePricing.updatedAt,
    })
    .from(servicePricing)
    .where(eq(servicePricing.serviceId, svc.id));

  // Omit the auth credential env from public response
  const { authCredentialEnv, ...publicFields } = svc;

  res.json({ ...publicFields, pricing });
});

// GET /services/:slug/pricing — just the pricing table
servicesRouter.get('/:slug/pricing', async (req: Request, res: Response) => {
  const slug = paramString(req.params.slug);

  const [svc] = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.slug, slug));

  if (!svc) {
    throw new NotFoundError('Service', slug);
  }

  const pricing = await db
    .select({
      operation: servicePricing.operation,
      costUsdMicros: servicePricing.costUsdMicros,
      priceUsdMicros: servicePricing.priceUsdMicros,
      priceSats: servicePricing.priceSats,
      unit: servicePricing.unit,
      updatedAt: servicePricing.updatedAt,
    })
    .from(servicePricing)
    .where(eq(servicePricing.serviceId, svc.id));

  res.json(pricing);
});

// ---------------------------------------------------------------------------
// Capabilities Catalog Router
// ---------------------------------------------------------------------------

export const capabilitiesCatalogRouter = Router();

// GET /capabilities — list all capabilities with descriptions and provider info
capabilitiesCatalogRouter.get('/', async (_req: Request, res: Response) => {
  const caps = getAllCapabilities();

  const result = await Promise.all(
    caps.map(async (cap) => {
      // Get pricing from the default provider
      const [svc] = await db
        .select({ id: services.id })
        .from(services)
        .where(eq(services.slug, cap.defaultProvider));

      let pricing: Array<{
        operation: string;
        priceUsdMicros: number;
        priceSats: number;
        unit: string;
      }> = [];

      if (svc) {
        pricing = await db
          .select({
            operation: servicePricing.operation,
            priceUsdMicros: servicePricing.priceUsdMicros,
            priceSats: servicePricing.priceSats,
            unit: servicePricing.unit,
          })
          .from(servicePricing)
          .where(eq(servicePricing.serviceId, svc.id));
      }

      return {
        capability: cap.capability,
        description: cap.description,
        providers: cap.providers.map((p) => ({
          slug: p.slug,
          priority: p.priority,
          active: p.active,
        })),
        defaultProvider: cap.defaultProvider,
        pricing,
      };
    }),
  );

  res.json(result);
});

// GET /capabilities/:capability — single capability detail
capabilitiesCatalogRouter.get('/:capability', async (req: Request, res: Response) => {
  const capName = paramString(req.params.capability);
  const cap = getCapability(capName);

  if (!cap) {
    throw new NotFoundError('Capability', capName);
  }

  // Get pricing from all providers for this capability
  const providersWithPricing = await Promise.all(
    cap.providers.map(async (provider) => {
      const [svc] = await db
        .select({ id: services.id, name: services.name })
        .from(services)
        .where(eq(services.slug, provider.slug));

      let pricing: Array<{
        operation: string;
        priceUsdMicros: number;
        priceSats: number;
        unit: string;
      }> = [];

      if (svc) {
        pricing = await db
          .select({
            operation: servicePricing.operation,
            priceUsdMicros: servicePricing.priceUsdMicros,
            priceSats: servicePricing.priceSats,
            unit: servicePricing.unit,
          })
          .from(servicePricing)
          .where(eq(servicePricing.serviceId, svc.id));
      }

      return {
        slug: provider.slug,
        name: svc?.name ?? provider.slug,
        priority: provider.priority,
        active: provider.active,
        pricing,
      };
    }),
  );

  res.json({
    capability: cap.capability,
    description: cap.description,
    defaultProvider: cap.defaultProvider,
    providers: providersWithPricing,
  });
});
