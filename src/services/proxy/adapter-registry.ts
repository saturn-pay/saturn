import { BaseAdapter } from './base-adapter.js';
import { serperAdapter } from './adapters/serper.adapter.js';
import { openaiAdapter } from './adapters/openai.adapter.js';
import { anthropicAdapter } from './adapters/anthropic.adapter.js';
import { firecrawlAdapter } from './adapters/firecrawl.adapter.js';
import { e2bAdapter } from './adapters/e2b.adapter.js';
import { jinaAdapter } from './adapters/jina.adapter.js';
import { braveSearchAdapter } from './adapters/brave-search.adapter.js';
import { resendAdapter } from './adapters/resend.adapter.js';
import { twilioAdapter } from './adapters/twilio.adapter.js';
import { replicateAdapter } from './adapters/replicate.adapter.js';
import { elevenlabsAdapter } from './adapters/elevenlabs.adapter.js';
import { deepgramAdapter } from './adapters/deepgram.adapter.js';
import { scraperApiAdapter } from './adapters/scraperapi.adapter.js';
import { hunterAdapter } from './adapters/hunter.adapter.js';
import { pineconeAdapter } from './adapters/pinecone.adapter.js';

const adapters = new Map<string, BaseAdapter>();

export function registerAdapter(adapter: BaseAdapter): void {
  adapters.set(adapter.slug, adapter);
}

export function getAdapter(slug: string): BaseAdapter | undefined {
  return adapters.get(slug);
}

export function getAllAdapterSlugs(): string[] {
  return Array.from(adapters.keys());
}

export function initAdapters(): void {
  registerAdapter(serperAdapter);
  registerAdapter(openaiAdapter);
  registerAdapter(anthropicAdapter);
  registerAdapter(firecrawlAdapter);
  registerAdapter(e2bAdapter);
  registerAdapter(jinaAdapter);
  registerAdapter(braveSearchAdapter);
  registerAdapter(resendAdapter);
  registerAdapter(twilioAdapter);
  registerAdapter(replicateAdapter);
  registerAdapter(elevenlabsAdapter);
  registerAdapter(deepgramAdapter);
  registerAdapter(scraperApiAdapter);
  registerAdapter(hunterAdapter);
  registerAdapter(pineconeAdapter);
}
