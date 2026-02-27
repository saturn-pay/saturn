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

/**
 * Map model name to a priced operation.
 * We only have pricing for gpt-4o and gpt-4o-mini.
 * Map other models to these operations for billing.
 */
function mapModelToOperation(model: string): string {
  // Mini/cheap models
  if (model.includes('mini') || model.includes('3.5') || model.includes('gpt-3')) {
    return 'gpt-4o-mini';
  }
  // Default to gpt-4o for all other models (gpt-4, gpt-4o, gpt-4-turbo, o1, etc.)
  return 'gpt-4o';
}

export class OpenAIAdapter extends BaseAdapter {
  slug = 'openai';

  async quote(body: unknown): Promise<QuoteResult> {
    const input = (body ?? {}) as OpenAIRequestBody;
    const model = (input.model as string) || 'gpt-4o';
    const max_tokens = (input.max_tokens as number) || 4096;
    const operation = mapModelToOperation(model);
    const pricing = await getPrice('openai', operation);
    const quotedSats = pricing.priceSats * Math.ceil(max_tokens / 1000);
    return { operation, quotedSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    // Transform normalized body to OpenAI format
    const input = body as Record<string, unknown>;
    let openaiBody: Record<string, unknown>;

    if (input.prompt && !input.messages) {
      // Normalized format: { prompt: "..." } -> OpenAI chat format
      openaiBody = {
        model: input.model || 'gpt-4o',
        messages: [{ role: 'user', content: input.prompt }],
        max_tokens: input.max_tokens || 4096,
      };
    } else {
      // Already in OpenAI format
      openaiBody = input;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiBody),
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
    const operation = mapModelToOperation(model ?? 'gpt-4o');
    const pricing = await getPrice('openai', operation);
    const actualSats = pricing.priceSats * Math.ceil(totalTokens / 1000);

    return { finalSats: Math.min(actualSats, quotedSats) };
  }
}

export const openaiAdapter = new OpenAIAdapter();
