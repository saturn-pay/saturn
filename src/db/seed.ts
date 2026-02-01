import 'dotenv/config';

import { db } from '../db/client.js';
import { services, servicePricing } from '../db/schema/index.js';
import { generateId } from '../lib/id.js';
import { ID_PREFIXES } from '../config/constants.js';

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

interface ServiceDef {
  slug: string;
  name: string;
  tier: string;
  authType: 'bearer' | 'api_key_header' | 'basic' | 'query_param';
  authCredentialEnv: string;
  baseUrl: string;
}

const SERVICE_DEFS: ServiceDef[] = [
  { slug: 'openai', name: 'OpenAI API', tier: 'premium', authType: 'bearer', authCredentialEnv: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com' },
  { slug: 'anthropic', name: 'Anthropic API', tier: 'premium', authType: 'api_key_header', authCredentialEnv: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com' },
  { slug: 'serper', name: 'Serper Search', tier: 'standard', authType: 'bearer', authCredentialEnv: 'SERPER_API_KEY', baseUrl: 'https://google.serper.dev' },
  { slug: 'firecrawl', name: 'Firecrawl Scraper', tier: 'standard', authType: 'bearer', authCredentialEnv: 'FIRECRAWL_API_KEY', baseUrl: 'https://api.firecrawl.dev' },
  { slug: 'e2b', name: 'E2B Code Sandbox', tier: 'premium', authType: 'bearer', authCredentialEnv: 'E2B_API_KEY', baseUrl: 'https://api.e2b.dev' },
  { slug: 'jina', name: 'Jina Reader', tier: 'standard', authType: 'bearer', authCredentialEnv: 'JINA_API_KEY', baseUrl: 'https://r.jina.ai' },
  { slug: 'brave-search', name: 'Brave Search', tier: 'standard', authType: 'api_key_header', authCredentialEnv: 'BRAVE_SEARCH_API_KEY', baseUrl: 'https://api.search.brave.com' },
  { slug: 'resend', name: 'Resend Email', tier: 'standard', authType: 'bearer', authCredentialEnv: 'RESEND_API_KEY', baseUrl: 'https://api.resend.com' },
  { slug: 'twilio', name: 'Twilio SMS', tier: 'premium', authType: 'basic', authCredentialEnv: 'TWILIO_ACCOUNT_SID', baseUrl: 'https://api.twilio.com' },
  { slug: 'replicate', name: 'Replicate AI', tier: 'premium', authType: 'bearer', authCredentialEnv: 'REPLICATE_API_TOKEN', baseUrl: 'https://api.replicate.com' },
  { slug: 'elevenlabs', name: 'ElevenLabs TTS', tier: 'premium', authType: 'api_key_header', authCredentialEnv: 'ELEVENLABS_API_KEY', baseUrl: 'https://api.elevenlabs.io' },
  { slug: 'deepgram', name: 'Deepgram STT', tier: 'premium', authType: 'bearer', authCredentialEnv: 'DEEPGRAM_API_KEY', baseUrl: 'https://api.deepgram.com' },
  { slug: 'scraperapi', name: 'ScraperAPI', tier: 'standard', authType: 'query_param', authCredentialEnv: 'SCRAPERAPI_API_KEY', baseUrl: 'https://api.scraperapi.com' },
  { slug: 'hunter', name: 'Hunter.io', tier: 'standard', authType: 'query_param', authCredentialEnv: 'HUNTER_API_KEY', baseUrl: 'https://api.hunter.io' },
];

// ---------------------------------------------------------------------------
// Pricing definitions
// ---------------------------------------------------------------------------

interface PricingDef {
  serviceSlug: string;
  operation: string;
  costUsdMicros: number;
  priceUsdMicros: number;
  unit: 'per_request' | 'per_1k_tokens' | 'per_minute';
}

const PRICING_DEFS: PricingDef[] = [
  { serviceSlug: 'openai', operation: 'gpt-4o', costUsdMicros: 2500, priceUsdMicros: 3250, unit: 'per_1k_tokens' },
  { serviceSlug: 'openai', operation: 'gpt-4o-mini', costUsdMicros: 150, priceUsdMicros: 195, unit: 'per_1k_tokens' },
  { serviceSlug: 'anthropic', operation: 'claude-sonnet', costUsdMicros: 3000, priceUsdMicros: 3900, unit: 'per_1k_tokens' },
  { serviceSlug: 'anthropic', operation: 'claude-haiku', costUsdMicros: 250, priceUsdMicros: 325, unit: 'per_1k_tokens' },
  { serviceSlug: 'serper', operation: 'search', costUsdMicros: 1000, priceUsdMicros: 1300, unit: 'per_request' },
  { serviceSlug: 'firecrawl', operation: 'scrape', costUsdMicros: 3000, priceUsdMicros: 3900, unit: 'per_request' },
  { serviceSlug: 'e2b', operation: 'execute', costUsdMicros: 5000, priceUsdMicros: 6500, unit: 'per_request' },
  { serviceSlug: 'jina', operation: 'read', costUsdMicros: 500, priceUsdMicros: 650, unit: 'per_request' },
  { serviceSlug: 'brave-search', operation: 'search', costUsdMicros: 500, priceUsdMicros: 650, unit: 'per_request' },
  { serviceSlug: 'resend', operation: 'send', costUsdMicros: 300, priceUsdMicros: 390, unit: 'per_request' },
  { serviceSlug: 'twilio', operation: 'sms', costUsdMicros: 7500, priceUsdMicros: 9750, unit: 'per_request' },
  { serviceSlug: 'replicate', operation: 'predict', costUsdMicros: 5000, priceUsdMicros: 6500, unit: 'per_request' },
  { serviceSlug: 'elevenlabs', operation: 'tts', costUsdMicros: 3000, priceUsdMicros: 3900, unit: 'per_request' },
  { serviceSlug: 'deepgram', operation: 'transcribe', costUsdMicros: 2500, priceUsdMicros: 3250, unit: 'per_minute' },
  { serviceSlug: 'scraperapi', operation: 'scrape', costUsdMicros: 2000, priceUsdMicros: 2600, unit: 'per_request' },
  { serviceSlug: 'hunter', operation: 'lookup', costUsdMicros: 2000, priceUsdMicros: 2600, unit: 'per_request' },
];

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('Seeding services...');

  const now = new Date();

  // Build a slug -> id map so we can reference service IDs in pricing rows
  const slugToId: Record<string, string> = {};

  for (const svc of SERVICE_DEFS) {
    const id = generateId(ID_PREFIXES.service);
    slugToId[svc.slug] = id;

    await db
      .insert(services)
      .values({
        id,
        slug: svc.slug,
        name: svc.name,
        tier: svc.tier,
        status: 'active',
        authType: svc.authType,
        authCredentialEnv: svc.authCredentialEnv,
        baseUrl: svc.baseUrl,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: services.slug,
        set: {
          name: svc.name,
          tier: svc.tier,
          authType: svc.authType,
          authCredentialEnv: svc.authCredentialEnv,
          baseUrl: svc.baseUrl,
          updatedAt: now,
        },
      });
  }

  console.log(`  Upserted ${SERVICE_DEFS.length} services`);

  // Re-fetch all services to get canonical IDs (in case rows already existed)
  const existingServices = await db.select().from(services);
  for (const row of existingServices) {
    slugToId[row.slug] = row.id;
  }

  console.log('Seeding service pricing...');

  for (const p of PRICING_DEFS) {
    const serviceId = slugToId[p.serviceSlug];
    if (!serviceId) {
      console.warn(`  Skipping pricing for unknown service: ${p.serviceSlug}`);
      continue;
    }

    await db
      .insert(servicePricing)
      .values({
        id: generateId(ID_PREFIXES.servicePricing),
        serviceId,
        operation: p.operation,
        costUsdMicros: p.costUsdMicros,
        priceUsdMicros: p.priceUsdMicros,
        priceSats: 1, // will be recalculated by rate updater
        unit: p.unit,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [servicePricing.serviceId, servicePricing.operation],
        set: {
          costUsdMicros: p.costUsdMicros,
          priceUsdMicros: p.priceUsdMicros,
          unit: p.unit,
          updatedAt: now,
        },
      });
  }

  console.log(`  Upserted ${PRICING_DEFS.length} pricing rows`);
  console.log('Seed complete.');
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
