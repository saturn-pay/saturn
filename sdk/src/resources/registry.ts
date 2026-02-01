import type { HttpClient, RequestOptions } from '../client.js';
import type { RegistrySubmission, ServiceSubmission } from '../types.js';

export class RegistryResource {
  constructor(private readonly client: HttpClient) {}

  async submit(body: RegistrySubmission, opts?: RequestOptions): Promise<ServiceSubmission> {
    return this.client.post<ServiceSubmission>('/v1/registry/submit', body, opts);
  }

  async list(opts?: RequestOptions): Promise<ServiceSubmission[]> {
    return this.client.get<ServiceSubmission[]>('/v1/registry/submissions', undefined, opts);
  }

  async get(id: string, opts?: RequestOptions): Promise<ServiceSubmission> {
    return this.client.get<ServiceSubmission>(`/v1/registry/submissions/${id}`, undefined, opts);
  }
}
