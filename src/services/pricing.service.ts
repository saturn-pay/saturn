import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { services, servicePricing } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Cached BTC/USD rate
// ---------------------------------------------------------------------------

let cachedRate: { btcUsd: number; fetchedAt: Date } = {
  btcUsd: 100_000, // sensible default until first fetch
  fetchedAt: new Date(0),
};

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a price in USD micros to satoshis at the given BTC/USD rate.
 *
 * Formula: ceil(usdMicros * 100_000_000 / (btcUsd * 1_000_000))
 *        = ceil(usdMicros * 100 / btcUsd)
 */
export function usdMicrosToSats(usdMicros: number, btcUsd: number): number {
  return Math.ceil((usdMicros * 100) / btcUsd);
}

/**
 * Convert a price in USD cents to satoshis at the given BTC/USD rate.
 * Floors to be conservative (never over-credit).
 */
export function usdCentsToSats(usdCents: number, btcUsd: number): number {
  return Math.floor(usdCents * 1_000_000 / btcUsd);
}

// ---------------------------------------------------------------------------
// Rate cache accessors
// ---------------------------------------------------------------------------

export function getCurrentRate(): { btcUsd: number; fetchedAt: Date } {
  return { ...cachedRate };
}

export function setCurrentRate(btcUsd: number): void {
  cachedRate = { btcUsd, fetchedAt: new Date() };
  logger.info({ btcUsd }, 'BTC/USD rate updated in pricing cache');
}

// ---------------------------------------------------------------------------
// Price lookup
// ---------------------------------------------------------------------------

export async function getPrice(
  serviceSlug: string,
  operation: string,
): Promise<{
  costUsdMicros: number;
  priceUsdMicros: number;
  priceSats: number;
  unit: string;
}> {
  const [row] = await db
    .select({
      costUsdMicros: servicePricing.costUsdMicros,
      priceUsdMicros: servicePricing.priceUsdMicros,
      priceSats: servicePricing.priceSats,
      unit: servicePricing.unit,
    })
    .from(servicePricing)
    .innerJoin(services, eq(services.id, servicePricing.serviceId))
    .where(
      and(eq(services.slug, serviceSlug), eq(servicePricing.operation, operation)),
    );

  if (!row) {
    throw new Error(`No pricing found for ${serviceSlug}/${operation}`);
  }

  return row;
}

// ---------------------------------------------------------------------------
// Bulk refresh
// ---------------------------------------------------------------------------

/**
 * Recalculate price_sats for every row in service_pricing using the latest
 * BTC/USD rate, then persist the updates.
 */
export async function refreshAllPrices(btcUsd: number): Promise<void> {
  const rows = await db.select().from(servicePricing);

  let updated = 0;

  for (const row of rows) {
    const newPriceSats = usdMicrosToSats(row.priceUsdMicros, btcUsd);

    if (newPriceSats !== row.priceSats) {
      await db
        .update(servicePricing)
        .set({ priceSats: newPriceSats, updatedAt: new Date() })
        .where(eq(servicePricing.id, row.id));
      updated++;
    }
  }

  logger.info({ btcUsd, total: rows.length, updated }, 'Refreshed all service pricing (sats)');
}
