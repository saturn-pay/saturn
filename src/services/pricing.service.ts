import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { services, servicePricing } from '../db/schema/index.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Cached rates
// ---------------------------------------------------------------------------

let cachedBtcRate: { btcUsd: number; fetchedAt: Date } = {
  btcUsd: 100_000, // sensible default until first fetch
  fetchedAt: new Date(0),
};

let cachedUsdBrlRate: { usdBrl: number; fetchedAt: Date } = {
  usdBrl: 5.25, // sensible default until first fetch
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

/**
 * Convert satoshis to USD cents at the given BTC/USD rate.
 * Ceils to ensure we hold enough USD to cover the cost.
 */
export function satsToUsdCents(sats: number, btcUsd: number): number {
  return Math.ceil((sats * btcUsd) / 1_000_000);
}

// ---------------------------------------------------------------------------
// Rate cache accessors
// ---------------------------------------------------------------------------

export function getCurrentRate(): { btcUsd: number; fetchedAt: Date } {
  return { ...cachedBtcRate };
}

export function setCurrentRate(btcUsd: number): void {
  cachedBtcRate = { btcUsd, fetchedAt: new Date() };
  logger.info({ btcUsd }, 'BTC/USD rate updated in pricing cache');
}

export function getUsdBrlRate(): { usdBrl: number; fetchedAt: Date } {
  return { ...cachedUsdBrlRate };
}

export function setUsdBrlRate(usdBrl: number): void {
  cachedUsdBrlRate = { usdBrl, fetchedAt: new Date() };
  logger.info({ usdBrl }, 'USD/BRL rate updated in pricing cache');
}

/**
 * Convert USD cents to BRL cents at the given exchange rate.
 */
export function usdCentsToBrlCents(usdCents: number, usdBrl: number): number {
  return Math.round(usdCents * usdBrl);
}

/**
 * Fetch live USD/BRL rate from awesomeapi (free Brazilian API).
 * Falls back to cached rate if fetch fails.
 */
export async function fetchUsdBrlRate(): Promise<number> {
  // Return cached if fresh (less than 5 minutes old)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (cachedUsdBrlRate.fetchedAt > fiveMinutesAgo) {
    return cachedUsdBrlRate.usdBrl;
  }

  try {
    // Primary: AwesomeAPI (Brazilian API, free, reliable)
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    if (res.ok) {
      const data = await res.json() as { USDBRL?: { bid?: string } };
      const rate = parseFloat(data?.USDBRL?.bid || '');
      if (!isNaN(rate) && rate > 0) {
        setUsdBrlRate(rate);
        return rate;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch USD/BRL from awesomeapi');
  }

  // Return cached rate as last resort
  logger.warn({ cachedRate: cachedUsdBrlRate.usdBrl }, 'Using cached USD/BRL rate');
  return cachedUsdBrlRate.usdBrl;
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
