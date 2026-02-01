import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class JinaAdapter extends BaseAdapter {
  slug = 'jina';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('jina', 'read');
    return { operation: 'read', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) throw new Error('JINA_API_KEY is not set');

    const res = await fetch('https://r.jina.ai/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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

export const jinaAdapter = new JinaAdapter();
