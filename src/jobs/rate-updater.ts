import cron from 'node-cron';
import { db } from '../db/client.js';
import { rateSnapshots } from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES, RATE_UPDATE_INTERVAL_CRON } from '../config/constants.js';
import * as pricing from '../services/pricing.service.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchCoinGecko(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = (await res.json()) as { bitcoin?: { usd?: number } };
    const rate = data?.bitcoin?.usd;
    if (typeof rate !== 'number' || rate <= 0) throw new Error('Invalid CoinGecko response');
    return rate;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch BTC/USD from CoinGecko');
    return null;
  }
}

async function fetchKraken(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
    );
    if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
    const data = (await res.json()) as {
      error?: string[];
      result?: { XXBTZUSD?: { c?: [string] } };
    };
    if (data.error && data.error.length > 0) throw new Error(data.error.join(', '));
    const lastPrice = data?.result?.XXBTZUSD?.c?.[0];
    if (!lastPrice) throw new Error('Missing Kraken price field');
    const rate = parseFloat(lastPrice);
    if (isNaN(rate) || rate <= 0) throw new Error('Invalid Kraken price');
    return rate;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch BTC/USD from Kraken');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Median helper
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) throw new Error('No values for median');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

// ---------------------------------------------------------------------------
// Core update logic
// ---------------------------------------------------------------------------

export async function runRateUpdate(): Promise<void> {
  logger.info('Starting BTC/USD rate update');

  const results = await Promise.all([fetchCoinGecko(), fetchKraken()]);
  const rates = results.filter((r): r is number => r !== null);

  if (rates.length === 0) {
    logger.error('All BTC/USD rate sources failed — skipping update');
    return;
  }

  const newRate = median(rates);
  const sources = [
    results[0] !== null ? 'coingecko' : null,
    results[1] !== null ? 'kraken' : null,
  ]
    .filter(Boolean)
    .join(',');

  const now = new Date();

  // Insert rate snapshot
  await db.insert(rateSnapshots).values({
    id: generateId(ID_PREFIXES.rateSnapshot),
    btcUsd: newRate.toFixed(2),
    source: sources,
    fetchedAt: now,
  });

  // Update pricing
  await pricing.refreshAllPrices(newRate);
  pricing.setCurrentRate(newRate);

  logger.info({ btcUsd: newRate, sources }, 'BTC/USD rate update complete');
}

// ---------------------------------------------------------------------------
// Cron scheduler
// ---------------------------------------------------------------------------

export function startRateUpdater(): void {
  logger.info({ cron: RATE_UPDATE_INTERVAL_CRON }, 'Scheduling BTC/USD rate updater');

  cron.schedule(RATE_UPDATE_INTERVAL_CRON, () => {
    void runRateUpdate();
  });
}
