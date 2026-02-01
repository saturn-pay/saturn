import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

interface AnthropicRequestBody {
  model?: string;
  max_tokens?: number;
  [key: string]: unknown;
}

interface AnthropicResponseData {
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  model?: string;
  [key: string]: unknown;
}

function mapModelToOperation(model: string): string {
  if (model.includes('haiku')) return 'claude-haiku';
  return 'claude-sonnet';
}

export class AnthropicAdapter extends BaseAdapter {
  slug = 'anthropic';

  async quote(body: unknown): Promise<QuoteResult> {
    const { model = 'claude-sonnet', max_tokens = 4096 } = (body ?? {}) as AnthropicRequestBody;
    const operation = mapModelToOperation(model);
    const pricing = await getPrice('anthropic', operation);
    const quotedSats = pricing.priceSats * Math.ceil(max_tokens / 1000);
    return { operation, quotedSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
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
    const data = response.data as AnthropicResponseData;
    const usage = data?.usage;

    if (!usage) {
      return { finalSats: quotedSats };
    }

    const totalTokens = usage.input_tokens + usage.output_tokens;
    const model = data.model ?? 'claude-sonnet';
    const operation = mapModelToOperation(model);
    const pricing = await getPrice('anthropic', operation);
    const actualSats = pricing.priceSats * Math.ceil(totalTokens / 1000);

    return { finalSats: Math.min(actualSats, quotedSats) };
  }
}

export const anthropicAdapter = new AnthropicAdapter();
