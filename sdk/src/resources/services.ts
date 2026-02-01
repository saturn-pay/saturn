import type { HttpClient, RequestOptions } from '../client.js';
import type { Service, ServiceDetail, ServicePricing } from '../types.js';

export class ServicesResource {
  constructor(private readonly client: HttpClient) {}

  async list(opts?: RequestOptions): Promise<Service[]> {
    return this.client.get<Service[]>('/v1/services', undefined, opts);
  }

  async get(slug: string, opts?: RequestOptions): Promise<ServiceDetail> {
    return this.client.get<ServiceDetail>(`/v1/services/${slug}`, undefined, opts);
  }

  async pricing(slug: string, opts?: RequestOptions): Promise<ServicePricing[]> {
    return this.client.get<ServicePricing[]>(`/v1/services/${slug}/pricing`, undefined, opts);
  }
}
