import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class HunterAdapter extends BaseAdapter {
  slug = 'hunter';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('hunter', 'lookup');
    return { operation: 'lookup', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) throw new Error('HUNTER_API_KEY is not set');

    const { domain, first_name, last_name } = body as {
      domain: string;
      first_name: string;
      last_name: string;
    };

    const url = new URL('https://api.hunter.io/v2/email-finder');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('domain', domain);
    url.searchParams.set('first_name', first_name);
    url.searchParams.set('last_name', last_name);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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

export const hunterAdapter = new HunterAdapter();
