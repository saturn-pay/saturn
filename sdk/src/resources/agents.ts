import type { HttpClient, RequestOptions } from '../client.js';
import type {
  Agent,
  CreateAgentRequest,
  CreateAgentResponse,
  UpdateAgentRequest,
} from '../types.js';
import { PoliciesResource } from './policies.js';
import { WalletsResource } from './wallets.js';

export class AgentsResource {
  public readonly policy: PoliciesResource;
  public readonly wallet: WalletsResource;

  constructor(private readonly client: HttpClient) {
    this.policy = new PoliciesResource(client);
    this.wallet = new WalletsResource(client);
  }

  async create(params: CreateAgentRequest, opts?: RequestOptions): Promise<CreateAgentResponse> {
    return this.client.post<CreateAgentResponse>('/v1/agents', params, opts);
  }

  async list(opts?: RequestOptions): Promise<Agent[]> {
    return this.client.get<Agent[]>('/v1/agents', undefined, opts);
  }

  async get(agentId: string, opts?: RequestOptions): Promise<Agent> {
    return this.client.get<Agent>(`/v1/agents/${agentId}`, undefined, opts);
  }

  async update(agentId: string, params: UpdateAgentRequest, opts?: RequestOptions): Promise<Agent> {
    return this.client.patch<Agent>(`/v1/agents/${agentId}`, params, opts);
  }

  async delete(agentId: string, opts?: RequestOptions): Promise<void> {
    return this.client.delete(`/v1/agents/${agentId}`, opts);
  }
}
