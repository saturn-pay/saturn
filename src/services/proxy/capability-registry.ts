// Capability-verb to provider routing registry.
// Maps 10 capability verbs to provider adapter pools with priority-based selection.

import { getAdapter } from './adapter-registry.js';
import type { BaseAdapter } from './base-adapter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderEntry {
  slug: string;
  priority: number;
  active: boolean;
}

export interface CapabilityEntry {
  capability: string;
  description: string;
  providers: ProviderEntry[];
  defaultProvider: string;
}

export type CapabilityVerb =
  | 'reason'
  | 'search'
  | 'read'
  | 'scrape'
  | 'execute'
  | 'email'
  | 'sms'
  | 'imagine'
  | 'speak'
  | 'transcribe';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const capabilities = new Map<string, CapabilityEntry>();

function register(entry: CapabilityEntry): void {
  capabilities.set(entry.capability, entry);
}

// ---------------------------------------------------------------------------
// Init — define all 10 capability verb mappings
// ---------------------------------------------------------------------------

export function initCapabilities(): void {
  register({
    capability: 'reason',
    description: 'Think, plan, write, generate code. General reasoning and LLM inference.',
    providers: [
      { slug: 'openai', priority: 1, active: true },
      { slug: 'anthropic', priority: 2, active: true },
    ],
    defaultProvider: 'openai',
  });

  register({
    capability: 'search',
    description: 'Find current, factual information. Web search results.',
    providers: [
      { slug: 'serper', priority: 1, active: true },
      { slug: 'brave-search', priority: 2, active: true },
    ],
    defaultProvider: 'serper',
  });

  register({
    capability: 'read',
    description: 'Turn URLs into clean, structured text. Crawl and extract content.',
    providers: [
      { slug: 'jina', priority: 1, active: true },
      { slug: 'firecrawl', priority: 2, active: true },
    ],
    defaultProvider: 'jina',
  });

  register({
    capability: 'scrape',
    description: 'Read sites that block bots. JS rendering, proxy rotation, anti-bot handling.',
    providers: [
      { slug: 'firecrawl', priority: 1, active: true },
      { slug: 'scraperapi', priority: 2, active: true },
    ],
    defaultProvider: 'firecrawl',
  });

  register({
    capability: 'execute',
    description: 'Run code safely in a sandboxed environment.',
    providers: [
      { slug: 'e2b', priority: 1, active: true },
    ],
    defaultProvider: 'e2b',
  });

  register({
    capability: 'email',
    description: 'Send transactional email. Notifications, reports, one-off messages.',
    providers: [
      { slug: 'resend', priority: 1, active: true },
    ],
    defaultProvider: 'resend',
  });

  register({
    capability: 'sms',
    description: 'Send short text messages. Alerts, verifications, time-sensitive pings.',
    providers: [
      { slug: 'twilio', priority: 1, active: true },
    ],
    defaultProvider: 'twilio',
  });

  register({
    capability: 'imagine',
    description: 'Generate images from prompts. Diagrams, visuals, mockups.',
    providers: [
      { slug: 'replicate', priority: 1, active: true },
    ],
    defaultProvider: 'replicate',
  });

  register({
    capability: 'speak',
    description: 'Turn text into natural voice. Audio responses, voice reports.',
    providers: [
      { slug: 'elevenlabs', priority: 1, active: true },
    ],
    defaultProvider: 'elevenlabs',
  });

  register({
    capability: 'transcribe',
    description: 'Turn audio into text. Meetings, voice notes, interviews.',
    providers: [
      { slug: 'deepgram', priority: 1, active: true },
    ],
    defaultProvider: 'deepgram',
  });
}

// ---------------------------------------------------------------------------
// Runtime registration — for community services approved via the registry
// ---------------------------------------------------------------------------

/**
 * Add a provider to an existing capability at runtime.
 * Used when a submitted service is approved and needs to join a capability pool.
 */
export function addProvider(capability: string, slug: string, priority: number): void {
  const entry = capabilities.get(capability);
  if (!entry) {
    throw new Error(`Unknown capability: ${capability}`);
  }

  // Avoid duplicates
  if (entry.providers.some((p) => p.slug === slug)) {
    return;
  }

  entry.providers.push({ slug, priority, active: true });
  // Re-sort by priority
  entry.providers.sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a capability verb to the best available provider adapter.
 * Returns the highest-priority active provider's adapter.
 */
export function resolveProvider(capability: string): BaseAdapter | undefined {
  const entry = capabilities.get(capability);
  if (!entry) return undefined;

  // Find highest-priority active provider
  const activeProviders = entry.providers
    .filter((p) => p.active)
    .sort((a, b) => a.priority - b.priority);

  for (const provider of activeProviders) {
    const adapter = getAdapter(provider.slug);
    if (adapter) return adapter;
  }

  return undefined;
}

/**
 * Resolve a capability verb to the provider slug that will handle it.
 */
export function resolveProviderSlug(capability: string): string | undefined {
  const entry = capabilities.get(capability);
  if (!entry) return undefined;

  const activeProviders = entry.providers
    .filter((p) => p.active)
    .sort((a, b) => a.priority - b.priority);

  for (const provider of activeProviders) {
    const adapter = getAdapter(provider.slug);
    if (adapter) return provider.slug;
  }

  return undefined;
}

/**
 * Get a capability entry by name.
 */
export function getCapability(capability: string): CapabilityEntry | undefined {
  return capabilities.get(capability);
}

/**
 * Get all registered capabilities.
 */
export function getAllCapabilities(): CapabilityEntry[] {
  return Array.from(capabilities.values());
}

/**
 * Check if a string is a valid capability verb.
 */
export function isCapability(value: string): value is CapabilityVerb {
  return capabilities.has(value);
}
