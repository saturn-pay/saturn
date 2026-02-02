import { BaseAdapter, QuoteResult, ExecuteResult, FinalizeResult } from '../base-adapter.js';
import { getPrice } from '../../pricing.service.js';

export class ElevenLabsAdapter extends BaseAdapter {
  slug = 'elevenlabs';

  async quote(_body: unknown): Promise<QuoteResult> {
    const pricing = await getPrice('elevenlabs', 'tts');
    return { operation: 'tts', quotedSats: pricing.priceSats };
  }

  async execute(body: unknown): Promise<ExecuteResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');

    const { voice_id, text, model_id } = body as {
      voice_id?: string;
      text: string;
      model_id?: string;
    };

    const voiceId = voice_id || 'default';

    // Validate voice_id to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
      throw new Error('Invalid voice_id');
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, model_id }),
      },
    );

    // TTS returns audio binary; encode as base64 for JSON transport
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'audio/mpeg';

    return {
      status: res.status,
      data: { audio_base64: base64, content_type: contentType },
      headers: Object.fromEntries(res.headers.entries()),
    };
  }

  async finalize(_response: ExecuteResult, quotedSats: number): Promise<FinalizeResult> {
    return { finalSats: quotedSats };
  }
}

export const elevenlabsAdapter = new ElevenLabsAdapter();
