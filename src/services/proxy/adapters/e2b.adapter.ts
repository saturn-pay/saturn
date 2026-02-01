import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class E2BAdapter extends BaseAdapter {
  slug = 'e2b';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('e2b', 'execute');
    return { operation: 'execute', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) throw new Error('E2B_API_KEY is not set');

    const res = await fetch('https://api.e2b.dev/v1/sandboxes', {
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

export const e2bAdapter = new E2BAdapter();
