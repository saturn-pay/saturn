import { HttpClient, type RequestOptions } from './client.js';
import { AccountsResource } from './resources/accounts.js';
import { AgentsResource } from './resources/agents.js';
import { PoliciesResource } from './resources/policies.js';
import { WalletsResource } from './resources/wallets.js';
import { ServicesResource } from './resources/services.js';
import { CapabilitiesResource } from './resources/capabilities.js';
import { AdminResource } from './resources/admin.js';
import { RegistryResource } from './resources/registry.js';
import { fromResponse } from './errors.js';
import type {
  SaturnConfig,
  SignupRequest,
  SignupResponse,
  ProxyCallResponse,
  ReasonRequest, NormalizedReasonResponse,
  SearchRequest, NormalizedSearchResponse,
  ReadRequest, NormalizedReadResponse,
  ScrapeRequest, NormalizedScrapeResponse,
  ExecuteRequest, NormalizedExecuteResponse,
  EmailRequest, NormalizedEmailResponse,
  SmsRequest, NormalizedSmsResponse,
  ImagineRequest, NormalizedImagineResponse,
  SpeakRequest, NormalizedSpeakResponse,
  TranscribeRequest, NormalizedTranscribeResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.saturn-pay.com';

export class Saturn {
  private readonly client: HttpClient;

  public readonly accounts: AccountsResource;
  public readonly agents: AgentsResource;
  public readonly policies: PoliciesResource;
  public readonly wallet: WalletsResource;
  public readonly services: ServicesResource;
  public readonly capabilities: CapabilitiesResource;
  public readonly admin: AdminResource;
  public readonly registry: RegistryResource;

  constructor(config: SaturnConfig) {
    this.client = new HttpClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    });

    this.accounts = new AccountsResource(this.client);
    this.agents = new AgentsResource(this.client);
    this.policies = new PoliciesResource(this.client);
    this.wallet = new WalletsResource(this.client);
    this.services = new ServicesResource(this.client);
    this.capabilities = new CapabilitiesResource(this.client);
    this.admin = new AdminResource(this.client);
    this.registry = new RegistryResource(this.client);
  }

  // ---------------------------------------------------------------------------
  // Static signup — creates account + primary agent, returns authenticated SDK
  // ---------------------------------------------------------------------------

  static async signup(params: {
    name: string;
    email?: string;
    baseUrl?: string;
  }): Promise<{ saturn: Saturn; apiKey: string; agentId: string; accountId: string }> {
    const baseUrl = (params.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

    const body: Record<string, string> = { name: params.name };
    if (params.email) {
      body.email = params.email;
    }

    const res = await fetch(`${baseUrl}/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorBody: unknown;
      try { errorBody = await res.json(); } catch { errorBody = {}; }
      throw fromResponse(res.status, errorBody as Record<string, unknown>);
    }

    const data = (await res.json()) as SignupResponse;

    const saturn = new Saturn({
      apiKey: data.apiKey,
      baseUrl: params.baseUrl,
    });

    return {
      saturn,
      apiKey: data.apiKey,
      agentId: data.agentId,
      accountId: data.accountId,
    };
  }

  // ---------------------------------------------------------------------------
  // Capability methods — POST /v1/capabilities/:capability
  // ---------------------------------------------------------------------------

  reason(body: ReasonRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedReasonResponse>> {
    return this.client.proxyPost<NormalizedReasonResponse>('/v1/capabilities/reason', body, opts);
  }

  search(body: SearchRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedSearchResponse>> {
    return this.client.proxyPost<NormalizedSearchResponse>('/v1/capabilities/search', body, opts);
  }

  read(body: ReadRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedReadResponse>> {
    return this.client.proxyPost<NormalizedReadResponse>('/v1/capabilities/read', body, opts);
  }

  scrape(body: ScrapeRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedScrapeResponse>> {
    return this.client.proxyPost<NormalizedScrapeResponse>('/v1/capabilities/scrape', body, opts);
  }

  execute(body: ExecuteRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedExecuteResponse>> {
    return this.client.proxyPost<NormalizedExecuteResponse>('/v1/capabilities/execute', body, opts);
  }

  email(body: EmailRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedEmailResponse>> {
    return this.client.proxyPost<NormalizedEmailResponse>('/v1/capabilities/email', body, opts);
  }

  sms(body: SmsRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedSmsResponse>> {
    return this.client.proxyPost<NormalizedSmsResponse>('/v1/capabilities/sms', body, opts);
  }

  imagine(body: ImagineRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedImagineResponse>> {
    return this.client.proxyPost<NormalizedImagineResponse>('/v1/capabilities/imagine', body, opts);
  }

  speak(body: SpeakRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedSpeakResponse>> {
    return this.client.proxyPost<NormalizedSpeakResponse>('/v1/capabilities/speak', body, opts);
  }

  transcribe(body: TranscribeRequest, opts?: RequestOptions): Promise<ProxyCallResponse<NormalizedTranscribeResponse>> {
    return this.client.proxyPost<NormalizedTranscribeResponse>('/v1/capabilities/transcribe', body, opts);
  }

  // ---------------------------------------------------------------------------
  // Generic service call — POST /v1/proxy/:serviceSlug
  // ---------------------------------------------------------------------------

  call<T = unknown>(serviceSlug: string, body: unknown, opts?: RequestOptions): Promise<ProxyCallResponse<T>> {
    return this.client.proxyPost<T>(`/v1/proxy/${serviceSlug}`, body, opts);
  }
}

// Re-export everything
export * from './types.js';
export * from './errors.js';
export { HttpClient } from './client.js';
export type { ClientConfig, RequestOptions } from './client.js';
export { AccountsResource } from './resources/accounts.js';
export { AgentsResource } from './resources/agents.js';
export { PoliciesResource } from './resources/policies.js';
export { WalletsResource } from './resources/wallets.js';
export { ServicesResource } from './resources/services.js';
export { CapabilitiesResource } from './resources/capabilities.js';
export { AdminResource } from './resources/admin.js';
export { RegistryResource } from './resources/registry.js';
