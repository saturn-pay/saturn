import type { HttpClient, RequestOptions } from '../client.js';
import type { Policy, ReplacePolicyRequest, UpdatePolicyRequest } from '../types.js';

export class PoliciesResource {
  constructor(private readonly client: HttpClient) {}

  async get(agentId: string, opts?: RequestOptions): Promise<Policy> {
    return this.client.get<Policy>(`/v1/agents/${agentId}/policy`, undefined, opts);
  }

  async replace(agentId: string, params: ReplacePolicyRequest, opts?: RequestOptions): Promise<Policy> {
    return this.client.put<Policy>(`/v1/agents/${agentId}/policy`, params, opts);
  }

  async update(agentId: string, params: UpdatePolicyRequest, opts?: RequestOptions): Promise<Policy> {
    return this.client.patch<Policy>(`/v1/agents/${agentId}/policy`, params, opts);
  }

  async kill(agentId: string, opts?: RequestOptions): Promise<Policy> {
    return this.client.post<Policy>(`/v1/agents/${agentId}/policy/kill`, {}, opts);
  }

  async unkill(agentId: string, opts?: RequestOptions): Promise<Policy> {
    return this.client.post<Policy>(`/v1/agents/${agentId}/policy/unkill`, {}, opts);
  }
}
