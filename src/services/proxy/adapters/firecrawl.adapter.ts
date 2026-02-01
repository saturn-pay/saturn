import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class FirecrawlAdapter extends BaseAdapter {
  slug = 'firecrawl';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('firecrawl', 'scrape');
    return { operation: 'scrape', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    return {
      status: res.status,
      data,
      headers: Object.fromEntries(res.headers.entries()),
    };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    return { finalSats: quotedSats };
  }
}

export const firecrawlAdapter = new FirecrawlAdapter();
