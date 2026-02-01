import type { HttpClient, RequestOptions } from '../client.js';
import type {
  AdminStats,
  AdminAgent,
  AdminTransaction,
  AdminTransactionsParams,
  AuditLog,
  AuditLogDetail,
  AdminAuditLogsParams,
  ServiceHealth,
  RateInfo,
  Paginated,
} from '../types.js';

export class AdminResource {
  constructor(private readonly client: HttpClient) {}

  async stats(opts?: RequestOptions): Promise<AdminStats> {
    return this.client.get<AdminStats>('/v1/admin/stats', undefined, opts);
  }

  async agents(opts?: RequestOptions): Promise<AdminAgent[]> {
    return this.client.get<AdminAgent[]>('/v1/admin/agents', undefined, opts);
  }

  async transactions(params?: AdminTransactionsParams, opts?: RequestOptions): Promise<Paginated<AdminTransaction>> {
    return this.client.get<Paginated<AdminTransaction>>('/v1/admin/transactions', params as Record<string, unknown>, opts);
  }

  async auditLogs(params?: AdminAuditLogsParams, opts?: RequestOptions): Promise<Paginated<AuditLog>> {
    return this.client.get<Paginated<AuditLog>>('/v1/admin/audit-logs', params as Record<string, unknown>, opts);
  }

  async auditLog(id: string, opts?: RequestOptions): Promise<AuditLogDetail> {
    return this.client.get<AuditLogDetail>(`/v1/admin/audit-logs/${id}`, undefined, opts);
  }

  async servicesHealth(opts?: RequestOptions): Promise<ServiceHealth[]> {
    return this.client.get<ServiceHealth[]>('/v1/admin/services/health', undefined, opts);
  }

  async rates(opts?: RequestOptions): Promise<RateInfo> {
    return this.client.get<RateInfo>('/v1/admin/rates', undefined, opts);
  }
}
