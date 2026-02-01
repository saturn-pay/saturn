import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class PineconeAdapter extends BaseAdapter {
  slug = 'pinecone';

  async quote(body: unknown): Promise<QuoteResult> {
    const { operation } = body as { operation: 'upsert' | 'query' };
    const pricing = await getPrice('pinecone', operation);
    return { operation, quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.PINECONE_API_KEY;
    const environment = process.env.PINECONE_ENVIRONMENT;
    if (!apiKey) throw new Error('PINECONE_API_KEY is not set');
    if (!environment) throw new Error('PINECONE_ENVIRONMENT is not set');

    const { index, operation, ...payload } = body as {
      index: string;
      operation: 'upsert' | 'query';
      [k: string]: unknown;
    };

    const url = `https://${index}-${environment}.svc.pinecone.io/${operation}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

export const pineconeAdapter = new PineconeAdapter();
