import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class DeepgramAdapter extends BaseAdapter {
  slug = 'deepgram';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('deepgram', 'transcribe');
    return { operation: 'transcribe', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not set');

    const payload = body as { content_type?: string; [k: string]: unknown };
    const contentType = payload.content_type || 'application/json';

    const res = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': contentType,
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

export const deepgramAdapter = new DeepgramAdapter();
