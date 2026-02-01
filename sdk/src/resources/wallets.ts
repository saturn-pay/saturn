import type { HttpClient, RequestOptions } from '../client.js';
import type {
  Wallet,
  FundWalletRequest,
  FundWalletResponse,
  Invoice,
  Transaction,
  Paginated,
  PaginationParams,
} from '../types.js';

export class WalletsResource {
  constructor(private readonly client: HttpClient) {}

  // ── Account-scoped (operator using agentId) ──

  async get(agentId: string, opts?: RequestOptions): Promise<Wallet> {
    return this.client.get<Wallet>(`/v1/agents/${agentId}/wallet`, undefined, opts);
  }

  async fund(agentId: string, params: FundWalletRequest, opts?: RequestOptions): Promise<FundWalletResponse> {
    return this.client.post<FundWalletResponse>(`/v1/agents/${agentId}/wallet/fund`, params, opts);
  }

  async invoices(agentId: string, params?: { status?: string }, opts?: RequestOptions): Promise<Invoice[]> {
    return this.client.get<Invoice[]>(`/v1/agents/${agentId}/wallet/invoices`, params as Record<string, unknown>, opts);
  }

  async transactions(agentId: string, params?: PaginationParams, opts?: RequestOptions): Promise<Paginated<Transaction>> {
    return this.client.get<Paginated<Transaction>>(`/v1/agents/${agentId}/wallet/transactions`, params as Record<string, unknown>, opts);
  }

  // ── Agent-scoped (agent key, no agentId needed) ──

  async getSelf(opts?: RequestOptions): Promise<Wallet> {
    return this.client.get<Wallet>('/v1/wallet', undefined, opts);
  }

  async fundSelf(params: FundWalletRequest, opts?: RequestOptions): Promise<FundWalletResponse> {
    return this.client.post<FundWalletResponse>('/v1/wallet/fund', params, opts);
  }

  async invoicesSelf(params?: { status?: string }, opts?: RequestOptions): Promise<Invoice[]> {
    return this.client.get<Invoice[]>('/v1/wallet/invoices', params as Record<string, unknown>, opts);
  }

  async transactionsSelf(params?: PaginationParams, opts?: RequestOptions): Promise<Paginated<Transaction>> {
    return this.client.get<Paginated<Transaction>>('/v1/wallet/transactions', params as Record<string, unknown>, opts);
  }
}
