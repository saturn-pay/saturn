import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class ScraperApiAdapter extends BaseAdapter {
  slug = 'scraperapi';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('scraperapi', 'scrape');
    return { operation: 'scrape', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.SCRAPERAPI_API_KEY;
    if (!apiKey) throw new Error('SCRAPERAPI_API_KEY is not set');

    const { url } = body as { url: string };

    const requestUrl =
      `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}`;

    const res = await fetch(requestUrl, { method: 'GET' });

    // ScraperAPI returns raw HTML; wrap it for consistent JSON transport
    const text = await res.text();

    return {
      status: res.status,
      data: { html: text },
      headers: Object.fromEntries(res.headers.entries()),
    };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    return { finalSats: quotedSats };
  }
}

export const scraperApiAdapter = new ScraperApiAdapter();
