import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

interface OpenAIRequestBody {
  model?: string;
  max_tokens?: number;
  [key: string]: unknown;
}

interface OpenAIResponseData {
  usage?: {
    total_tokens: number;
  };
  [key: string]: unknown;
}

export class OpenAIAdapter extends BaseAdapter {
  slug = 'openai';

  async quote(body: unknown): Promise<QuoteResult> {
    const { model = 'gpt-4o', max_tokens = 4096 } = (body ?? {}) as OpenAIRequestBody;
    const operation = model;
    const pricing = await getPrice('openai', operation);
    const quotedSats = pricing.priceSats * Math.ceil(max_tokens / 1000);
    return { operation, quotedSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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

  async finalize(response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    const data = response.data as OpenAIResponseData;
    const totalTokens = data?.usage?.total_tokens;

    if (totalTokens == null) {
      return { finalSats: quotedSats };
    }

    // Re-derive the per-1k rate from the quote operation
    // We need the model from the response to look up the correct pricing
    const model = (data as Record<string, unknown>).model as string | undefined;
    const operation = model ?? 'gpt-4o';
    const pricing = await getPrice('openai', operation);
    const actualSats = pricing.priceSats * Math.ceil(totalTokens / 1000);

    return { finalSats: Math.min(actualSats, quotedSats) };
  }
}

export const openaiAdapter = new OpenAIAdapter();
