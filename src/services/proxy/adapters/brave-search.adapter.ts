import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class BraveSearchAdapter extends BaseAdapter {
  slug = 'brave-search';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('brave-search', 'search');
    return { operation: 'search', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY is not set');

    const { q } = body as { q: string };
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
      },
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

export const braveSearchAdapter = new BraveSearchAdapter();
