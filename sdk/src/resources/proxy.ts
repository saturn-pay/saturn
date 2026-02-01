import type { HttpClient, RequestOptions } from '../client.js';
import type {
  ProxyCallResponse,
  OpenAIChatRequest,
  OpenAIChatResponse,
  AnthropicMessageRequest,
  AnthropicMessageResponse,
} from '../types.js';

export class ProxyResource {
  constructor(private readonly client: HttpClient) {}

  async call<T = unknown>(serviceSlug: string, body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<T>> {
    return this.client.proxyPost<T>(`/v1/proxy/${serviceSlug}`, body, opts);
  }

  async openai(body: OpenAIChatRequest, opts?: RequestOptions): Promise<ProxyCallResponse<OpenAIChatResponse>> {
    return this.call<OpenAIChatResponse>('openai', body, opts);
  }

  async anthropic(body: AnthropicMessageRequest, opts?: RequestOptions): Promise<ProxyCallResponse<AnthropicMessageResponse>> {
    return this.call<AnthropicMessageResponse>('anthropic', body, opts);
  }

  async serper(body: { q: string; [key: string]: unknown }, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('serper', body, opts);
  }

  async twilio(body: { Body: string; To: string }, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('twilio', body, opts);
  }

  async firecrawl(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('firecrawl', body, opts);
  }

  async e2b(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('e2b', body, opts);
  }

  async jina(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('jina', body, opts);
  }

  async braveSearch(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('brave-search', body, opts);
  }

  async resend(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('resend', body, opts);
  }

  async replicate(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('replicate', body, opts);
  }

  async elevenlabs(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('elevenlabs', body, opts);
  }

  async deepgram(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('deepgram', body, opts);
  }

  async scraperapi(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('scraperapi', body, opts);
  }

  async hunter(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('hunter', body, opts);
  }

  async pinecone(body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<unknown>> {
    return this.call('pinecone', body, opts);
  }
}
