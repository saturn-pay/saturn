import type { HttpClient, RequestOptions } from '../client.js';
import type { Capability, CapabilityDetail } from '../types.js';

export class CapabilitiesResource {
  constructor(private readonly client: HttpClient) {}

  async list(opts?: RequestOptions): Promise<Capability[]> {
    return this.client.get<Capability[]>('/v1/capabilities', undefined, opts);
  }

  async get(capability: string, opts?: RequestOptions): Promise<CapabilityDetail> {
    return this.client.get<CapabilityDetail>(`/v1/capabilities/${capability}`, undefined, opts);
  }
}
