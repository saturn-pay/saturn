// Copied from sdk/src/types.ts — dashboard-relevant interfaces only

export interface Paginated<T> {
  data: T[];
  total?: number;
  limit: number;
  offset: number;
}

export interface SignupRequest {
  name: string;
  email?: string;
}

export interface SignupResponse {
  agentId: string;
  apiKey: string;
  accountId: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  accountId: string;
  name: string;
  status: 'active' | 'suspended' | 'killed';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  balanceSats?: number;
}

export interface AdminStats {
  satsIn: number;
  satsOut: number;
  activeAgents: number;
  totalTransactions: number;
  revenueEstimateSats: number;
}

export interface AdminAgent {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'killed';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  balanceSats: number;
  heldSats: number;
  lifetimeIn: number;
  lifetimeOut: number;
  todaySpendSats: number;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: 'credit_lightning' | 'debit_proxy_call' | 'refund' | 'withdrawal';
  amountSats: number;
  balanceAfter: number;
  referenceType: 'invoice' | 'proxy_call' | null;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export interface AdminTransaction extends Transaction {
  agentId: string;
}

export interface AuditLog {
  id: string;
  agentId: string;
  serviceSlug: string;
  capability: string | null;
  operation: string | null;
  policyResult: 'allowed' | 'denied';
  policyReason: string | null;
  quotedSats: number;
  chargedSats: number | null;
  upstreamStatus: number | null;
  upstreamLatencyMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface RateInfo {
  current: {
    usdPerBtc: number;
    satsPerUsd: number;
    fetchedAt: string;
  };
  history: Array<{
    usdPerBtc: number;
    satsPerUsd: number;
    fetchedAt: string;
  }>;
}
