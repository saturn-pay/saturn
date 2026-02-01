import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 60_000;

export class ReplicateAdapter extends BaseAdapter {
  slug = 'replicate';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('replicate', 'predict');
    return { operation: 'predict', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) throw new Error('REPLICATE_API_TOKEN is not set');

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // Create the prediction
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const prediction = (await createRes.json()) as { id: string; status: string; [k: string]: unknown };

    if (createRes.status !== 201) {
      return {
        status: createRes.status,
        data: prediction,
        headers: Object.fromEntries(createRes.headers.entries()),
      };
    }

    // Poll until terminal state
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let current = prediction;

    while (current.status !== 'succeeded' && current.status !== 'failed') {
      if (Date.now() >= deadline) {
        throw new Error(`Replicate prediction ${current.id} timed out after ${POLL_TIMEOUT_MS / 1000}s`);
      }

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${current.id}`, {
        method: 'GET',
        headers,
      });

      current = (await pollRes.json()) as typeof prediction;
    }

    return {
      status: current.status === 'succeeded' ? 200 : 500,
      data: current,
    };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    return { finalSats: quotedSats };
  }
}

export const replicateAdapter = new ReplicateAdapter();
