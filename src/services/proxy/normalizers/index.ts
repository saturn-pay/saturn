// Per-capability normalizer functions.
// Transforms raw upstream responses into a consistent shape per capability verb.

import type {
  NormalizedReasonResponse,
  NormalizedSearchResponse,
  NormalizedReadResponse,
  NormalizedScrapeResponse,
  NormalizedExecuteResponse,
  NormalizedEmailResponse,
  NormalizedSmsResponse,
  NormalizedImagineResponse,
  NormalizedSpeakResponse,
  NormalizedTranscribeResponse,
} from './types.js';

// ---------------------------------------------------------------------------
// reason — OpenAI / Anthropic
// ---------------------------------------------------------------------------

function normalizeReason(provider: string, data: any): NormalizedReasonResponse {
  if (provider === 'anthropic') {
    const text = data?.content?.[0]?.text ?? '';
    return {
      content: text,
      model: data?.model ?? '',
      usage: {
        inputTokens: data?.usage?.input_tokens ?? 0,
        outputTokens: data?.usage?.output_tokens ?? 0,
        totalTokens: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0),
      },
      raw: data,
    };
  }

  // OpenAI (default)
  const content = data?.choices?.[0]?.message?.content ?? '';
  return {
    content,
    model: data?.model ?? '',
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    },
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// search — Serper / Brave Search
// ---------------------------------------------------------------------------

function normalizeSearch(provider: string, data: any): NormalizedSearchResponse {
  if (provider === 'brave-search') {
    const webResults = data?.web?.results ?? [];
    return {
      results: webResults.map((r: any) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      })),
      raw: data,
    };
  }

  // Serper (default)
  const organic = data?.organic ?? [];
  return {
    results: organic.map((r: any) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      snippet: r.snippet ?? '',
    })),
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// read — Jina / Firecrawl
// ---------------------------------------------------------------------------

function normalizeRead(provider: string, data: any): NormalizedReadResponse {
  if (provider === 'firecrawl') {
    return {
      content: data?.data?.markdown ?? data?.data?.content ?? '',
      title: data?.data?.metadata?.title,
      raw: data,
    };
  }

  // Jina (default)
  return {
    content: data?.data?.content ?? data?.content ?? '',
    title: data?.data?.title ?? data?.title,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// scrape — Firecrawl / ScraperAPI
// ---------------------------------------------------------------------------

function normalizeScrape(provider: string, data: any): NormalizedScrapeResponse {
  if (provider === 'scraperapi') {
    return {
      html: data?.html ?? (typeof data === 'string' ? data : ''),
      raw: data,
    };
  }

  // Firecrawl (default)
  return {
    html: data?.data?.html ?? '',
    text: data?.data?.markdown ?? data?.data?.content,
    metadata: data?.data?.metadata,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// execute — E2B
// ---------------------------------------------------------------------------

function normalizeExecute(_provider: string, data: any): NormalizedExecuteResponse {
  return {
    stdout: data?.stdout ?? data?.results?.[0]?.text ?? '',
    stderr: data?.stderr ?? '',
    exitCode: data?.exitCode ?? data?.exit_code ?? 0,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// email — Resend
// ---------------------------------------------------------------------------

function normalizeEmail(_provider: string, data: any): NormalizedEmailResponse {
  return {
    id: data?.id ?? '',
    status: data?.status ?? 'sent',
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// sms — Twilio
// ---------------------------------------------------------------------------

function normalizeSms(_provider: string, data: any): NormalizedSmsResponse {
  return {
    sid: data?.sid ?? '',
    status: data?.status ?? '',
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// imagine — Replicate
// ---------------------------------------------------------------------------

function normalizeImagine(_provider: string, data: any): NormalizedImagineResponse {
  // Replicate returns output as array of URLs or single URL
  const output = data?.output;
  const url = Array.isArray(output) ? output[0] : (output ?? data?.url ?? '');
  return {
    url,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// speak — ElevenLabs
// ---------------------------------------------------------------------------

function normalizeSpeak(_provider: string, data: any): NormalizedSpeakResponse {
  return {
    audio: data?.audio ?? data?.audio_base64 ?? '',
    format: data?.format ?? 'mp3',
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// transcribe — Deepgram
// ---------------------------------------------------------------------------

function normalizeTranscribe(_provider: string, data: any): NormalizedTranscribeResponse {
  const transcript =
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ??
    data?.transcript ??
    '';
  return {
    text: transcript,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const normalizers: Record<string, (provider: string, data: any) => unknown> = {
  reason: normalizeReason,
  search: normalizeSearch,
  read: normalizeRead,
  scrape: normalizeScrape,
  execute: normalizeExecute,
  email: normalizeEmail,
  sms: normalizeSms,
  imagine: normalizeImagine,
  speak: normalizeSpeak,
  transcribe: normalizeTranscribe,
};

/**
 * Normalize an upstream response based on capability and provider.
 * Falls back to `{ data: raw, raw }` for unknown capabilities or community services.
 */
export function normalize(capability: string, providerSlug: string, data: unknown): unknown {
  const fn = normalizers[capability];
  if (!fn) {
    return { data, raw: data };
  }
  return fn(providerSlug, data);
}
