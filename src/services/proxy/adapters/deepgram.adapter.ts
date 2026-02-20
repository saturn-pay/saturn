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

    const payload = body as { audio?: string; url?: string; content_type?: string; language?: string; [k: string]: unknown };

    let requestBody: BodyInit;
    let contentType: string;

    if (payload.url) {
      // URL-based transcription: send JSON with url field
      contentType = 'application/json';
      requestBody = JSON.stringify({ url: payload.url });
    } else if (payload.audio) {
      // Base64-encoded audio: decode and send as raw bytes
      contentType = payload.content_type || 'audio/wav';
      const buffer = Buffer.from(payload.audio, 'base64');
      requestBody = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      throw new Error('Either audio (base64) or url must be provided');
    }

    // Build query params for Deepgram options
    const params = new URLSearchParams();
    if (payload.language) params.set('language', payload.language);
    const queryString = params.toString();
    const url = `https://api.deepgram.com/v1/listen${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': contentType,
      },
      body: requestBody,
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
