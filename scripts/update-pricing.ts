#!/usr/bin/env npx tsx
/**
 * Pricing Update Script
 *
 * Updates all service pricing based on cost + margin.
 * Can be run manually or via cron.
 *
 * Usage:
 *   npx tsx scripts/update-pricing.ts                  # Use default 30% margin
 *   npx tsx scripts/update-pricing.ts --margin 25      # Use 25% margin
 *   npx tsx scripts/update-pricing.ts --dry-run        # Preview changes without saving
 *   npx tsx scripts/update-pricing.ts --service openai # Update only OpenAI pricing
 */

import 'dotenv/config';
import { db } from '../src/db/client.js';
import { servicePricing, services } from '../src/db/schema/index.js';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_MARGIN = 0.30; // 30% margin

// Provider cost definitions (in USD micros)
// Update these when providers change their pricing
const PROVIDER_COSTS: Record<string, Record<string, number>> = {
  openai: {
    'gpt-4o': 2500,           // $0.0025 per 1k tokens (blended input/output)
    'gpt-4o-mini': 150,       // $0.00015 per 1k tokens
    'gpt-4-turbo': 10000,     // $0.01 per 1k tokens
    'gpt-3.5-turbo': 500,     // $0.0005 per 1k tokens
  },
  anthropic: {
    'claude-sonnet': 3000,    // $0.003 per 1k tokens
    'claude-haiku': 250,      // $0.00025 per 1k tokens
    'claude-opus': 15000,     // $0.015 per 1k tokens
  },
  serper: {
    'search': 1000,           // $0.001 per request
  },
  'brave-search': {
    'search': 500,            // $0.0005 per request
  },
  firecrawl: {
    'scrape': 3000,           // $0.003 per request
  },
  jina: {
    'read': 500,              // $0.0005 per request
  },
  e2b: {
    'execute': 5000,          // $0.005 per request
  },
  resend: {
    'send': 300,              // $0.0003 per email
  },
  twilio: {
    'sms': 7500,              // $0.0075 per SMS (US)
  },
  replicate: {
    'predict': 5000,          // $0.005 per request (varies by model)
  },
  elevenlabs: {
    'tts': 3000,              // $0.003 per request
  },
  deepgram: {
    'transcribe': 2500,       // $0.0025 per minute
  },
  scraperapi: {
    'scrape': 2000,           // $0.002 per request
  },
  hunter: {
    'lookup': 2000,           // $0.002 per request
  },
  pinecone: {
    'upsert': 500,            // $0.0005 per request
    'query': 300,             // $0.0003 per request
  },
};

// BTC/USD rate for sats calculation (updated separately)
const SATS_PER_USD = 1500; // Approximate, should be fetched dynamically

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(): { margin: number; dryRun: boolean; service?: string } {
  const args = process.argv.slice(2);
  let margin = DEFAULT_MARGIN;
  let dryRun = false;
  let service: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--margin' && args[i + 1]) {
      margin = parseFloat(args[i + 1]) / 100;
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--service' && args[i + 1]) {
      service = args[i + 1];
      i++;
    }
  }

  return { margin, dryRun, service };
}

function calculatePrice(costUsdMicros: number, margin: number): number {
  return Math.round(costUsdMicros * (1 + margin));
}

function calculateSats(priceUsdMicros: number): number {
  const priceUsd = priceUsdMicros / 1_000_000;
  return Math.max(1, Math.round(priceUsd * SATS_PER_USD));
}

function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(6)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { margin, dryRun, service: filterService } = parseArgs();

  console.log('='.repeat(60));
  console.log('Saturn Pricing Update');
  console.log('='.repeat(60));
  console.log(`Margin: ${(margin * 100).toFixed(1)}%`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE'}`);
  if (filterService) {
    console.log(`Filter: ${filterService} only`);
  }
  console.log('='.repeat(60));
  console.log('');

  // Get all services
  const allServices = await db.select().from(services);
  const serviceMap = new Map(allServices.map(s => [s.slug, s]));

  // Get current pricing
  const currentPricing = await db.select().from(servicePricing);

  let updated = 0;
  let skipped = 0;
  const changes: Array<{
    service: string;
    operation: string;
    oldCost: number;
    newCost: number;
    oldPrice: number;
    newPrice: number;
    oldSats: number;
    newSats: number;
  }> = [];

  for (const pricing of currentPricing) {
    const svc = allServices.find(s => s.id === pricing.serviceId);
    if (!svc) {
      console.warn(`Warning: No service found for pricing ID ${pricing.id}`);
      skipped++;
      continue;
    }

    if (filterService && svc.slug !== filterService) {
      skipped++;
      continue;
    }

    // Get provider cost
    const providerCosts = PROVIDER_COSTS[svc.slug];
    if (!providerCosts) {
      console.warn(`Warning: No cost data for service "${svc.slug}"`);
      skipped++;
      continue;
    }

    const newCost = providerCosts[pricing.operation];
    if (newCost === undefined) {
      console.warn(`Warning: No cost data for "${svc.slug}/${pricing.operation}"`);
      skipped++;
      continue;
    }

    const newPrice = calculatePrice(newCost, margin);
    const newSats = calculateSats(newPrice);

    // Check if anything changed
    const costChanged = pricing.costUsdMicros !== newCost;
    const priceChanged = pricing.priceUsdMicros !== newPrice;

    if (costChanged || priceChanged) {
      changes.push({
        service: svc.slug,
        operation: pricing.operation,
        oldCost: pricing.costUsdMicros,
        newCost,
        oldPrice: pricing.priceUsdMicros,
        newPrice,
        oldSats: pricing.priceSats,
        newSats,
      });

      if (!dryRun) {
        await db
          .update(servicePricing)
          .set({
            costUsdMicros: newCost,
            priceUsdMicros: newPrice,
            priceSats: newSats,
            updatedAt: new Date(),
          })
          .where(eq(servicePricing.id, pricing.id));
      }

      updated++;
    } else {
      skipped++;
    }
  }

  // Print changes
  if (changes.length > 0) {
    console.log('Changes:');
    console.log('-'.repeat(60));

    for (const change of changes) {
      console.log(`${change.service}/${change.operation}:`);
      if (change.oldCost !== change.newCost) {
        console.log(`  Cost:  ${formatUsd(change.oldCost)} → ${formatUsd(change.newCost)}`);
      }
      console.log(`  Price: ${formatUsd(change.oldPrice)} → ${formatUsd(change.newPrice)}`);
      console.log(`  Sats:  ${change.oldSats} → ${change.newSats}`);
      console.log('');
    }
  }

  console.log('-'.repeat(60));
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  if (dryRun && updated > 0) {
    console.log('');
    console.log('Run without --dry-run to apply these changes.');
  }

  console.log('');
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
