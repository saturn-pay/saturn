import type { HttpClient, RequestOptions } from '../client.js';
import type {
  ProxyCallResponse,
  OpenAIChatRequest,
  OpenAIChatResponse,
  AnthropicMessageRequest,
  AnthropicMessageResponse,
  ReasonRequest,
  SearchRequest,
  ReadRequest,
  ScrapeRequest,
  ExecuteRequest,
  EmailRequest,
  SmsRequest,
  ImagineRequest,
  SpeakRequest,
  TranscribeRequest,
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
} from '../types.js';

export class ProxyResource {
  constructor(private readonly client: HttpClient) {}

  // ---------------------------------------------------------------------------
  // Capability methods — route to POST /v1/capabilities/:capability
  // ---------------------------------------------------------------------------

  async reason(body: ReasonRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedReasonResponse>> {
    return this.client.proxyPost<NormalizedReasonResponse>('/v1/capabilities/reason', body, opts);
  }

  async search(body: SearchRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedSearchResponse>> {
    return this.client.proxyPost<NormalizedSearchResponse>('/v1/capabilities/search', body, opts);
  }

  async read(body: ReadRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedReadResponse>> {
    return this.client.proxyPost<NormalizedReadResponse>('/v1/capabilities/read', body, opts);
  }

  async scrape(body: ScrapeRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedScrapeResponse>> {
    return this.client.proxyPost<NormalizedScrapeResponse>('/v1/capabilities/scrape', body, opts);
  }

  async execute(body: ExecuteRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedExecuteResponse>> {
    return this.client.proxyPost<NormalizedExecuteResponse>('/v1/capabilities/execute', body, opts);
  }

  async email(body: EmailRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedEmailResponse>> {
    return this.client.proxyPost<NormalizedEmailResponse>('/v1/capabilities/email', body, opts);
  }

  async sms(body: SmsRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedSmsResponse>> {
    return this.client.proxyPost<NormalizedSmsResponse>('/v1/capabilities/sms', body, opts);
  }

  async imagine(body: ImagineRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedImagineResponse>> {
    return this.client.proxyPost<NormalizedImagineResponse>('/v1/capabilities/imagine', body, opts);
  }

  async speak(body: SpeakRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedSpeakResponse>> {
    return this.client.proxyPost<NormalizedSpeakResponse>('/v1/capabilities/speak', body, opts);
  }

  async transcribe(body: TranscribeRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedTranscribeResponse>> {
    return this.client.proxyPost<NormalizedTranscribeResponse>('/v1/capabilities/transcribe', body, opts);
  }

  // ---------------------------------------------------------------------------
  // Generic call — backward compat via POST /v1/proxy/:serviceSlug
  // ---------------------------------------------------------------------------

  async call<T = unknown>(serviceSlug: string, body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<T>> {
    return this.client.proxyPost<T>(`/v1/proxy/${serviceSlug}`, body, opts);
  }

  // ---------------------------------------------------------------------------
  // Legacy convenience methods — backward compat
  // ---------------------------------------------------------------------------

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
