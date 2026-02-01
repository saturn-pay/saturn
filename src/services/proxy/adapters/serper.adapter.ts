import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class SerperAdapter extends BaseAdapter {
  slug = 'serper';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('serper', 'search');
    return { operation: 'search', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error('SERPER_API_KEY is not set');

    const res = await fetch('https://google.serper.dev/search', {
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

export const serperAdapter = new SerperAdapter();
